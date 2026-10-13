import asyncio
import json
import secrets
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path, PurePosixPath
from typing import Literal

import numpy as np
import pydicom
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field

from .archive import Archive, ImagingError
from .config import Config
from .imaging import build_volume, oblique, pixels, png, reconstruct, window
from .jobs import Jobs


class StorageRequest(BaseModel):
    path: str = Field(min_length=1, max_length=4096)


class Annotation(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,128}$")
    series_uid: str = Field(min_length=1, max_length=64)
    instance_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    frame: int = Field(ge=0)
    tool: Literal["length", "angle", "cobb", "polygon", "rectangle", "ellipse", "text"]
    points: list[tuple[float, float, float]] = Field(min_length=1, max_length=1024)
    units: Literal["mm", "pixels"]
    text: str = Field(default="", max_length=4096)


class ObliqueRequest(BaseModel):
    origin: tuple[float, float, float]
    u: tuple[float, float, float]
    v: tuple[float, float, float]
    rows: int = Field(default=512, ge=1, le=2048)
    columns: int = Field(default=512, ge=1, le=2048)
    spacing: tuple[float, float] = (1, 1)
    center: float = 40
    width: float = Field(default=400, ge=1)


def safe_relative(name):
    if not name or "\\" in name or ":" in name or "\x00" in name:
        raise ImagingError("Unsafe upload path.")
    path = PurePosixPath(name)
    if path.is_absolute() or any(p in (".", "..") for p in name.split("/")):
        raise ImagingError("Unsafe upload path.")
    return Path(*path.parts)


def create_app(config=None):
    config = config or Config.environment()
    archive, jobs = Archive(config), Jobs()
    @asynccontextmanager
    async def lifespan(app):
        yield
        jobs.close()
    app = FastAPI(title="MedVision Local API", version="0.1.0", docs_url=None, redoc_url=None, lifespan=lifespan)
    app.state.archive, app.state.jobs = archive, jobs
    app.add_middleware(CORSMiddleware, allow_origins=[config.origin], allow_methods=["GET", "POST", "PUT", "DELETE"],
                       allow_headers=["Authorization", "Content-Type"], expose_headers=["X-Image-Geometry", "X-Pixel-Shape", "X-Pixel-Dtype"])

    @app.middleware("http")
    async def guard(request: Request, call_next):
        if request.headers.get("host") != "127.0.0.1:8000":
            return JSONResponse({"detail": "Invalid local host."}, status_code=403)
        origin = request.headers.get("origin")
        if origin is not None and origin != config.origin:
            return JSONResponse({"detail": "Origin is not permitted."}, status_code=403)
        # Only a strictly validated CORS preflight may bypass bearer authentication.
        preflight = request.method == "OPTIONS" and origin == config.origin and request.headers.get("access-control-request-method") in ("GET", "POST", "PUT", "DELETE")
        if request.url.path != "/health" and not preflight:
            supplied = request.headers.get("authorization", "")
            if not secrets.compare_digest(supplied, "Bearer " + config.token):
                return JSONResponse({"detail": "A launch session is required."}, status_code=401)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(ImagingError)
    async def imaging_error(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=422)

    @app.exception_handler(KeyError)
    async def missing(request, exc):
        return JSONResponse({"detail": "Archive item not found."}, status_code=404)

    @app.get("/health")
    def health():
        return {"service": "medvision", "version": "0.1.0", "networking_enabled": False}

    @app.get("/api/v1/studies")
    def studies(q: str = ""):
        return archive.studies(q)

    @app.get("/api/v1/series/{series_uid}/instances")
    def instances(series_uid: str):
        return archive.instances(series_uid)

    @app.post("/api/v1/imports", status_code=202)
    async def import_files(files: list[UploadFile] = File(...)):
        if len(files) > 10000:
            raise HTTPException(413, "Too many files in one import.")
        directory = tempfile.TemporaryDirectory(prefix="medvision-import-", dir=config.data_dir)
        uploads = []
        total = 0
        try:
            seen = set()
            for upload in files:
                name = upload.filename or "image.dcm"
                relative = safe_relative(name)
                if str(relative).casefold() in seen:
                    raise ImagingError("Duplicate upload path.")
                seen.add(str(relative).casefold())
                destination = Path(directory.name) / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                size = 0
                with destination.open("xb") as out:
                    while chunk := await upload.read(1024 * 1024):
                        size += len(chunk)
                        total += len(chunk)
                        if size > config.max_file_bytes or total > config.max_volume_bytes * 4:
                            raise HTTPException(413, "Import exceeds the input budget.")
                        out.write(chunk)
                uploads.append((name, destination))
                await upload.close()
            def work(cancel, progress):
                result = {"imported": 0, "duplicates": 0, "errors": []}
                try:
                    for idx, (name, source) in enumerate(uploads):
                        if cancel.is_set():
                            break
                        try:
                            item = archive.import_file(source)
                            if item["status"] == "directory":
                                for reference in item["references"]:
                                    candidate = (source.parent / safe_relative(reference)).resolve()
                                    if not candidate.is_relative_to(Path(directory.name).resolve()) or not candidate.is_file():
                                        result["errors"].append({"file": name, "message": "DICOMDIR referenced file was not supplied."})
                            else:
                                key = "imported" if item["status"] == "imported" else "duplicates"
                                result[key] += 1
                        except ImagingError as exc:
                            result["errors"].append({"file": name, "message": str(exc)})
                        progress(idx + 1, len(uploads))
                    return result
                finally:
                    directory.cleanup()
            try:
                return jobs.submit("import", work)
            except ValueError as exc:
                raise HTTPException(429, str(exc)) from exc
        except Exception:
            directory.cleanup()
            raise
        finally:
            for upload in files:
                await upload.close()

    @app.get("/api/v1/jobs/{job_id}")
    def job(job_id: str):
        return jobs.get(job_id)

    @app.post("/api/v1/jobs/{job_id}/cancel")
    def cancel(job_id: str):
        return jobs.cancel(job_id)

    @app.get("/api/v1/instances/{image_id}/dicom")
    def dicom_file(image_id: str):
        return FileResponse(archive.instance(image_id)["path"], media_type="application/dicom", filename="image.dcm")

    @app.get("/api/v1/instances/{image_id}/metadata")
    def metadata(image_id: str):
        ds = pydicom.dcmread(archive.instance(image_id)["path"], stop_before_pixels=True)
        return ds.to_json_dict()

    @app.get("/api/v1/instances/{image_id}/pixels")
    def raw_pixels(image_id: str, frame: int = 0):
        ds, array, geometry = pixels(Path(archive.instance(image_id)["path"]), frame)
        return Response(array.tobytes(), media_type="application/octet-stream", headers={
            "X-Image-Geometry": json.dumps(geometry), "X-Pixel-Shape": json.dumps(list(array.shape)), "X-Pixel-Dtype": str(array.dtype)})

    @app.get("/api/v1/instances/{image_id}/preview")
    def preview(image_id: str, frame: int = 0, center: float | None = None, width: float | None = None, invert: bool = False):
        ds, array, geometry = pixels(Path(archive.instance(image_id)["path"]), frame)
        image = window(array, center, width, invert ^ (str(ds.PhotometricInterpretation) == "MONOCHROME1"))
        return Response(png(image), media_type="image/png")

    @app.get("/api/v1/settings")
    def settings():
        return {"storage_path": str(archive.storage), "networking_enabled": False, "max_volume_bytes": config.max_volume_bytes}

    @app.put("/api/v1/settings/storage")
    def storage(body: StorageRequest):
        return {"storage_path": archive.set_storage(body.path), "existing_studies_moved": False}

    @app.get("/api/v1/series/{series_uid}/annotations")
    def annotations(series_uid: str):
        with archive.connect() as db:
            return [json.loads(row[0]) for row in db.execute("SELECT body FROM annotations WHERE series_uid=?", (series_uid,))]

    @app.put("/api/v1/annotations/{annotation_id}")
    def save_annotation(annotation_id: str, body: Annotation):
        if annotation_id != body.id:
            raise ImagingError("Annotation identifier mismatch.")
        instance = archive.instance(body.instance_id)
        if body.series_uid != instance["series_uid"] or body.frame >= instance["frames"]:
            raise ImagingError("Annotation source mismatch.")
        if not np.all(np.isfinite(body.points)):
            raise ImagingError("Annotation coordinates must be finite.")
        with archive.connect() as db:
            db.execute("INSERT OR REPLACE INTO annotations(id,series_uid,body) VALUES(?,?,?)", (body.id, body.series_uid, body.model_dump_json()))
        return body

    @app.delete("/api/v1/annotations/{annotation_id}")
    def delete_annotation(annotation_id: str):
        with archive.connect() as db:
            db.execute("DELETE FROM annotations WHERE id=?", (annotation_id,))
        return {"deleted": True}

    @app.get("/api/v1/series/{series_uid}/reconstruction")
    def reconstruction(series_uid: str, plane: str = "axial", index: int = 0, projection: str = "slice", center: float = 40, width: float = 400):
        volume, geometry = build_volume(archive, series_uid)
        image = reconstruct(volume, plane, index, projection)
        return Response(png(window(image, center, width)), media_type="image/png", headers={"X-Image-Geometry": json.dumps(geometry)})

    @app.get("/api/v1/series/{series_uid}/volume")
    def volume_data(series_uid: str):
        volume, geometry = build_volume(archive, series_uid)
        return Response(volume.astype("<f4", copy=False).tobytes(), media_type="application/octet-stream", headers={"X-Image-Geometry": json.dumps(geometry), "X-Pixel-Dtype": "float32"})

    @app.post("/api/v1/series/{series_uid}/oblique")
    def oblique_image(series_uid: str, body: ObliqueRequest):
        if any(s <= 0 or not np.isfinite(s) for s in body.spacing):
            raise ImagingError("Spacing must be finite and positive.")
        volume, geometry = build_volume(archive, series_uid)
        image = oblique(volume, geometry, body.origin, body.u, body.v, (body.rows, body.columns), body.spacing)
        return Response(png(window(image, body.center, body.width)), media_type="image/png")

    return app
