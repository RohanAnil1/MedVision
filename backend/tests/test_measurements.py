import numpy as np
import pytest
from fastapi.testclient import TestClient

from medvision.app import create_app
from medvision.archive import ImagingError
from medvision.imaging import pixels
from medvision.measurements import calculate, measurement_csv, measurement_pdf


def test_calibrated_length_angles_roi(phantom):
    ds, image, geom = pixels(phantom["files"][0])
    assert calculate("length", [[10,20,30],[22,28,30]], "mm", ds, image, 0)["length"] == pytest.approx(np.hypot(12,8))
    assert calculate("angle", [[10,22,30],[10,20,30],[13,20,30]], "mm", ds, image, 0)["angle"] == pytest.approx(90)
    assert calculate("cobb", [[10,20,30],[13,20,30],[10,20,30],[13,23,30]], "mm", ds, image, 0)["angle"] == pytest.approx(45)
    corners = [[10,20,30],[22,20,30],[10,28,30],[22,28,30]]
    roi = calculate("rectangle", corners, "mm", ds, image, 0)
    assert roi["area"] == pytest.approx(96)
    assert roi["mean"] == pytest.approx(image[:5,:5].mean())
    assert roi["pixel_count"] == 25
    assert calculate("length", [[0,0,0],[3,4,0]], "pixels", ds, image, 0)["length"] == 5
    with pytest.raises(ImagingError):
        calculate("angle", [[0,0,0]]*3, "mm", ds, image, 0)
    with pytest.raises(ImagingError, match="calibration"):
        del ds.PixelSpacing
        calculate("length", [[0,0,0],[1,1,0]], "mm", ds, image, 0)


def test_annotation_persistence_and_exports(config, phantom):
    app = create_app(config)
    image_id = app.state.archive.import_file(phantom["files"][0])["id"]
    auth = {"Authorization": "Bearer " + config.token}
    item = {"id":"length-1","series_uid":phantom["series"],"instance_id":image_id,"frame":0,
            "tool":"length","units":"mm","points":[[10,20,30],[13,24,30]],"text":"=UNTRUSTED"}
    with TestClient(app, base_url="http://127.0.0.1:8000") as client:
        saved = client.put("/api/v1/annotations/length-1", json=item, headers=auth)
        assert saved.status_code == 200
        assert saved.json()["result"]["length"] == pytest.approx(5)
        prefix = f"/api/v1/series/{phantom['series']}"
        assert len(client.get(prefix + "/annotations", headers=auth).json()) == 1
        assert "'=UNTRUSTED" in client.get(prefix + "/exports/measurements?format=csv", headers=auth).text
        assert client.get(prefix + "/exports/measurements?format=pdf", headers=auth).content.startswith(b"%PDF-")
        assert client.delete("/api/v1/annotations/length-1", headers=auth).status_code == 200
        assert client.get(prefix + "/annotations", headers=auth).json() == []
