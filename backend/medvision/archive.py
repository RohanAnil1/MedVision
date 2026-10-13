import hashlib
import json
import os
import sqlite3
import threading
import uuid
from pathlib import Path

import pydicom
from pydicom.uid import UID


class ImagingError(ValueError):
    pass


def value(ds, name, default=None):
    item = getattr(ds, name, default)
    if item is None:
        return default
    if isinstance(item, (list, tuple, pydicom.multival.MultiValue)):
        return [str(v) for v in item]
    return str(item)


def numbers(ds, name):
    item = getattr(ds, name, None)
    if item is None:
        return None
    return [float(v) for v in item]


class Archive:
    def __init__(self, config):
        self.config = config
        self.root = config.data_dir
        self.root.mkdir(parents=True, exist_ok=True)
        self.db_path = self.root / "archive.sqlite3"
        self.lock = threading.RLock()
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS instances(
                  id TEXT PRIMARY KEY, sop_uid TEXT UNIQUE NOT NULL,
                  study_uid TEXT NOT NULL, series_uid TEXT NOT NULL,
                  hash TEXT NOT NULL, path TEXT NOT NULL, metadata TEXT NOT NULL,
                  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
                CREATE INDEX IF NOT EXISTS study_index ON instances(study_uid);
                CREATE INDEX IF NOT EXISTS series_index ON instances(series_uid);
                CREATE TABLE IF NOT EXISTS annotations(
                  id TEXT PRIMARY KEY, series_uid TEXT NOT NULL, body TEXT NOT NULL,
                  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
                PRAGMA user_version=1;
            """)
        self.storage.mkdir(parents=True, exist_ok=True)

    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=30)
        db.row_factory = sqlite3.Row
        return db

    @property
    def storage(self):
        with self.connect() as db:
            row = db.execute("SELECT value FROM settings WHERE key='storage'").fetchone()
        return Path(row[0]) if row else self.root / "studies"

    def set_storage(self, path):
        target = Path(path).expanduser()
        if not target.is_absolute():
            raise ImagingError("Storage location must be an absolute local path.")
        if str(target).startswith(("\\\\", "//")):
            raise ImagingError("Network storage is disabled.")
        target.mkdir(parents=True, exist_ok=True)
        probe = target / (".medvision-write-" + uuid.uuid4().hex)
        probe.write_bytes(b"")
        probe.unlink()
        with self.lock, self.connect() as db:
            db.execute("INSERT OR REPLACE INTO settings VALUES('storage', ?)", (str(target.resolve()),))
        return str(target.resolve())

    def import_file(self, source: Path):
        if source.stat().st_size > self.config.max_file_bytes:
            raise ImagingError("File exceeds the configured input limit.")
        try:
            ds = pydicom.dcmread(source, stop_before_pixels=True)
        except Exception as exc:
            raise ImagingError("Not a readable DICOM Part 10 file.") from exc
        if getattr(ds, "DirectoryRecordSequence", None) is not None:
            return {"status": "directory", "references": self.directory_references(ds)}
        for key in ("StudyInstanceUID", "SeriesInstanceUID", "SOPInstanceUID", "SOPClassUID"):
            uid = str(getattr(ds, key, ""))
            if not uid or not UID(uid).is_valid:
                raise ImagingError(f"Missing or invalid {key}.")
        rows, cols = int(getattr(ds, "Rows", 0)), int(getattr(ds, "Columns", 0))
        frames = int(getattr(ds, "NumberOfFrames", 1))
        samples = int(getattr(ds, "SamplesPerPixel", 1))
        if rows <= 0 or cols <= 0 or frames <= 0 or samples not in (1, 3):
            raise ImagingError("DICOM object is not a supported pixel image.")
        # Account for decoder allocations, not merely packed bits.
        if rows * cols * frames * samples * 8 > self.config.max_decoded_bytes:
            raise ImagingError("Decoded image exceeds the memory budget.")
        metadata = {
            "study_uid": str(ds.StudyInstanceUID), "series_uid": str(ds.SeriesInstanceUID),
            "sop_uid": str(ds.SOPInstanceUID), "sop_class_uid": str(ds.SOPClassUID),
            "patient_name": value(ds, "PatientName", ""), "patient_id": value(ds, "PatientID", ""),
            "study_date": value(ds, "StudyDate", ""), "study_description": value(ds, "StudyDescription", ""),
            "series_description": value(ds, "SeriesDescription", ""), "modality": value(ds, "Modality", "OT"),
            "instance_number": int(getattr(ds, "InstanceNumber", 0)), "rows": rows, "columns": cols,
            "frames": frames, "samples": samples,
            "photometric": value(ds, "PhotometricInterpretation", ""),
            "position": numbers(ds, "ImagePositionPatient"), "orientation": numbers(ds, "ImageOrientationPatient"),
            "spacing": numbers(ds, "PixelSpacing"),
            "window_center": value(ds, "WindowCenter"), "window_width": value(ds, "WindowWidth"),
            "transfer_syntax": str(ds.file_meta.TransferSyntaxUID),
            "frame_of_reference_uid": value(ds, "FrameOfReferenceUID", ""),
        }
        digest = hashlib.sha256()
        with source.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        checksum = digest.hexdigest()
        with self.lock, self.connect() as db:
            existing = db.execute("SELECT id,hash FROM instances WHERE sop_uid=?", (metadata["sop_uid"],)).fetchone()
            if existing:
                if existing["hash"] != checksum:
                    raise ImagingError("Conflicting image: existing SOPInstanceUID has different content.")
                return {"status": "duplicate", "id": existing["id"]}
            image_id = uuid.uuid4().hex
            destination = self.storage / (image_id + ".dcm")
            pending = destination.with_suffix(".pending")
            try:
                with source.open("rb") as src, pending.open("xb") as out:
                    for chunk in iter(lambda: src.read(1024 * 1024), b""):
                        out.write(chunk)
                    out.flush()
                    os.fsync(out.fileno())
                pending.replace(destination)
                db.execute("INSERT INTO instances(id,sop_uid,study_uid,series_uid,hash,path,metadata) VALUES(?,?,?,?,?,?,?)",
                           (image_id, metadata["sop_uid"], metadata["study_uid"], metadata["series_uid"], checksum, str(destination), json.dumps(metadata)))
            except Exception:
                pending.unlink(missing_ok=True)
                destination.unlink(missing_ok=True)
                raise
        return {"status": "imported", "id": image_id}

    @staticmethod
    def directory_references(ds):
        references = []
        for record in ds.DirectoryRecordSequence:
            parts = getattr(record, "ReferencedFileID", None)
            if parts is None:
                continue
            parts = [str(parts)] if isinstance(parts, str) else [str(p) for p in parts]
            if any(p in ("", ".", "..") or "/" in p or "\\" in p or ":" in p for p in parts):
                raise ImagingError("Unsafe DICOMDIR reference.")
            references.append("/".join(parts))
        return references

    def instance(self, image_id):
        with self.connect() as db:
            row = db.execute("SELECT * FROM instances WHERE id=?", (image_id,)).fetchone()
        if not row:
            raise KeyError(image_id)
        return {**json.loads(row["metadata"]), "id": row["id"], "path": row["path"]}

    def instances(self, series_uid=None):
        with self.connect() as db:
            rows = db.execute("SELECT id,metadata FROM instances" + (" WHERE series_uid=?" if series_uid else ""),
                              (series_uid,) if series_uid else ()).fetchall()
        return sorted([{**json.loads(r["metadata"]), "id": r["id"]} for r in rows], key=lambda r: (r["instance_number"], r["id"]))

    def studies(self, query=""):
        groups = {}
        for image in self.instances():
            uid = image["study_uid"]
            if uid not in groups:
                groups[uid] = {k: image[k] for k in ("study_uid", "patient_name", "patient_id", "study_date", "study_description")}
                groups[uid].update(series={}, instance_count=0)
            study = groups[uid]
            study["instance_count"] += 1
            series = study["series"].setdefault(image["series_uid"], {
                "series_uid": image["series_uid"], "description": image["series_description"],
                "modality": image["modality"], "instance_count": 0, "frame_count": 0, "first_instance_id": image["id"],
            })
            series["instance_count"] += 1
            series["frame_count"] += image["frames"]
        results = []
        for study in groups.values():
            study["series"] = list(study["series"].values())
            if query.casefold() in json.dumps(study).casefold():
                results.append(study)
        return sorted(results, key=lambda s: s["study_date"], reverse=True)
