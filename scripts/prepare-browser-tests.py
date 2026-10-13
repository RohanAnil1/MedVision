import sys
from pathlib import Path
import numpy as np
import pydicom
from pydicom.uid import generate_uid, RLELossless, JPEGLSLossless, JPEG2000Lossless

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
sys.path.insert(0, str(root / "backend" / "tests"))
from conftest import phantom
from medvision.archive import Archive
from medvision.config import Config

destination = Path(sys.argv[1])
destination.mkdir(parents=True, exist_ok=True)
fixture = phantom.__wrapped__(destination)
archive = Archive(Config(destination / "data", "test-session-" + "a" * 48))
for index, source in enumerate(fixture["files"]):
    ds = pydicom.dcmread(source)
    ds.Rows, ds.Columns = 64, 64
    ds.SeriesDescription = "Synthetic CT phantom"
    ds.RescaleSlope, ds.RescaleIntercept = 1, 0
    y, x = np.indices((64, 64))
    sphere = (x - 32) ** 2 + (y - 32) ** 2 + ((index - 2) * 8) ** 2 < 24 ** 2
    image = np.where(sphere, 600, -1000).astype(np.int16)
    ds.PixelData = image.tobytes()
    ds.save_as(source, enforce_file_format=True)
    archive.import_file(source)
for syntax, description in [(RLELossless,"RLE phantom"),(JPEGLSLossless,"JPEG-LS phantom"),(JPEG2000Lossless,"JPEG2000 phantom")]:
    ds=pydicom.dcmread(fixture["files"][2])
    ds.SeriesInstanceUID=generate_uid()
    ds.SeriesDescription=description
    ds.compress(syntax)
    path=destination / (description + '.dcm')
    ds.save_as(path,enforce_file_format=True)
    archive.import_file(path)
