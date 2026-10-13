import time
from fastapi.testclient import TestClient

from medvision.app import create_app
from medvision.app import safe_relative
from medvision.archive import ImagingError
import pytest
import os


def test_local_security_and_import(config, phantom):
    app = create_app(config)
    auth = {"Authorization": "Bearer " + config.token}
    with TestClient(app, base_url="http://127.0.0.1:8000") as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/v1/studies").status_code == 401
        assert client.get("/api/v1/studies", headers={**auth, "Origin": "https://attacker.invalid"}).status_code == 403
        assert client.get("/api/v1/studies", headers={**auth, "Host": "attacker.invalid:8000"}).status_code == 403
        response = client.post("/api/v1/imports", headers=auth, files=[("files", (p.name, p.read_bytes(), "application/dicom")) for p in phantom["files"]])
        assert response.status_code == 202
        job_id = response.json()["id"]
        for _ in range(100):
            job = client.get(f"/api/v1/jobs/{job_id}", headers=auth).json()
            if job["status"] in ("completed", "failed"):
                break
            time.sleep(0.01)
        assert job["status"] == "completed", job
        assert job["result"]["imported"] == 5
        studies = client.get("/api/v1/studies", headers=auth).json()
        assert studies[0]["series"][0]["frame_count"] == 5
        image_id = studies[0]["series"][0]["first_instance_id"]
        preview = client.get(f"/api/v1/instances/{image_id}/preview", headers=auth)
        assert preview.content.startswith(b"\x89PNG")
        assert preview.headers["cache-control"] == "no-store"
        volume = client.get(f"/api/v1/series/{phantom['series']}/volume", headers=auth)
        assert len(volume.content) == 5 * 6 * 8 * 4
        assert "origin" in volume.headers["x-image-geometry"]
        assert client.get(f"/api/v1/instances/{image_id}/preview?frame=100", headers=auth).status_code == 422


def test_malicious_upload_and_partial_import(config, phantom):
    app = create_app(config)
    auth = {"Authorization": "Bearer " + config.token}
    with TestClient(app, base_url="http://127.0.0.1:8000") as client:
        result = client.post("/api/v1/imports", headers=auth, files={"files": ("../escape.dcm", b"evil")})
        assert result.status_code == 422
        result = client.post("/api/v1/imports", headers=auth, files=[("files", ("bad.dcm", b"bad")), ("files", ("good.dcm", phantom["files"][0].read_bytes()))])
        for _ in range(100):
            job = client.get(f"/api/v1/jobs/{result.json()['id']}", headers=auth).json()
            if job["status"] == "completed":
                break
            time.sleep(0.01)
        assert job["result"]["imported"] == 1
        assert len(job["result"]["errors"]) == 1


def test_alternative_storage_preserves_old_studies(config, phantom, tmp_path):
    app = create_app(config)
    auth = {"Authorization": "Bearer " + config.token}
    old = app.state.archive.import_file(phantom["files"][0])
    original_path = app.state.archive.instance(old["id"])["path"]
    with TestClient(app, base_url="http://127.0.0.1:8000") as client:
        assert client.put("/api/v1/settings/storage", headers=auth, json={"path": str(tmp_path / "new-location")}).status_code == 200
        assert app.state.archive.instance(old["id"])["path"] == original_path
        new = app.state.archive.import_file(phantom["files"][1])
        assert "new-location" in app.state.archive.instance(new["id"])["path"]


@pytest.mark.parametrize("name",["NUL.dcm","dir/COM1","../image","/absolute","dir\\image","image:stream","dir/image."])
def test_portable_upload_paths(name):
    with pytest.raises(ImagingError):
        safe_relative(name)


def test_storage_failures_preserve_previous_location(archive,tmp_path):
    original=archive.storage
    target=tmp_path/'existing-file'
    target.write_text('not a directory')
    with pytest.raises(ImagingError,match='not writable'):
        archive.set_storage(str(target))
    with pytest.raises(ImagingError,match='absolute'):
        archive.set_storage('relative-location')
    with pytest.raises(ImagingError,match='Network'):
        archive.set_storage('//server/share')
    assert archive.storage==original


@pytest.mark.skipif(os.name!='nt',reason='Windows mapped-drive API')
def test_mapped_network_storage_rejected_before_io(archive,monkeypatch):
    import ctypes
    original=archive.storage
    monkeypatch.setattr(ctypes.windll.kernel32,'GetDriveTypeW',lambda drive:4)
    with pytest.raises(ImagingError,match='Network'):
        archive.set_storage('Z:/remote-studies')
    assert archive.storage==original
