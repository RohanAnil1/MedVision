"""Reproducible local synthetic volume benchmark; never reads patient studies."""
import json
import platform
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import pydicom
from pydicom.uid import generate_uid

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
sys.path.insert(0, str(root / "backend/tests"))
from conftest import phantom
from medvision.archive import Archive
from medvision.config import Config
from medvision.imaging import build_volume, reconstruct

with tempfile.TemporaryDirectory(prefix="medvision-benchmark-") as temporary:
    directory = Path(temporary)
    fixture = phantom.__wrapped__(directory)
    template = pydicom.dcmread(fixture["files"][0])
    template.Rows = template.Columns = 256
    template.PixelSpacing = [0.75, 0.75]
    template.RescaleSlope, template.RescaleIntercept = 1, 0
    rows, columns = np.indices((256, 256))
    paths = []
    for z in range(128):
        template.SOPInstanceUID = generate_uid()
        template.file_meta.MediaStorageSOPInstanceUID = template.SOPInstanceUID
        template.InstanceNumber = z + 1
        template.ImagePositionPatient = [0, 0, z * 1.5]
        inside = (rows - 128) ** 2 + (columns - 128) ** 2 + ((z - 64) * 2) ** 2 < 95 ** 2
        template.PixelData = np.where(inside, 600, -1000).astype(np.int16).tobytes()
        path = directory / f"benchmark-{z:03}.dcm"
        template.save_as(path, enforce_file_format=True)
        paths.append(path)
    archive = Archive(Config(directory / "archive", "benchmark-" + "a" * 32))
    start = time.perf_counter()
    for path in paths:
        archive.import_file(path)
    imported = time.perf_counter() - start
    start = time.perf_counter()
    volume, geometry = build_volume(archive, str(template.SeriesInstanceUID))
    built = time.perf_counter() - start
    start = time.perf_counter()
    for i in range(100):
        reconstruct(volume, "coronal", i, "slice")
    mpr = (time.perf_counter() - start) / 100
    start = time.perf_counter()
    projection = reconstruct(volume, "axial", 0, "mip")
    mip = time.perf_counter() - start
    assert volume.shape == (128, 256, 256)
    assert float(volume[64, 128, 128]) == 600
    assert float(projection[0, 0]) == -1000
    result = {
        "date": "2026-10-13", "os": platform.platform(), "architecture": platform.machine(), "python": platform.python_version(),
        "dataset": "synthetic CT sphere; 128 x 256 x 256, signed 16-bit DICOM, float32 reconstruction",
        "original_bytes": sum(path.stat().st_size for path in paths), "volume_bytes": volume.nbytes,
        "import_seconds": round(imported, 6), "reconstruct_seconds": round(built, 6),
        "mean_coronal_slice_seconds": round(mpr, 6), "full_axial_mip_seconds": round(mip, 6),
        "limitations": "CPU backend baseline only; no physical GPU timing, large-study stress, or macOS qualification",
    }
    (root / "docs/benchmark-windows.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
