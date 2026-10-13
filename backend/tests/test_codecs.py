import numpy as np
import pydicom
import pytest
from pydicom.uid import RLELossless, JPEGLSLossless, JPEG2000Lossless

from medvision.imaging import pixels


@pytest.mark.parametrize("syntax", [RLELossless, JPEGLSLossless, JPEG2000Lossless])
def test_lossless_compressed_signed_pixels(phantom, syntax, tmp_path):
    ds = pydicom.dcmread(phantom["files"][0])
    ds.Rows = ds.Columns = 64
    row, column = np.indices((64,64))
    stored = (row * 10 + column - 1000).astype(np.int16)
    ds.PixelData = stored.tobytes()
    ds.compress(syntax)
    path = tmp_path / f"{syntax}.dcm"
    ds.save_as(path, enforce_file_format=True)
    _, decoded, _ = pixels(path)
    np.testing.assert_array_equal(decoded, stored.astype(np.float32) * 2 - 1000)
