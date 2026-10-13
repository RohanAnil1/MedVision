import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import pytest
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, CTImageStorage, generate_uid

from medvision.config import Config
from medvision.archive import Archive


@pytest.fixture
def config(tmp_path):
    return Config(tmp_path / "data", "test-secret-" + "a" * 48)


@pytest.fixture
def archive(config):
    return Archive(config)


@pytest.fixture
def phantom(tmp_path):
    study, series, reference = generate_uid(), generate_uid(), generate_uid()
    files = []
    arrays = []
    # A known linear scalar field: z*100 + row*10 + column, stored signed.
    for z in range(5):
        meta = FileMetaDataset()
        meta.TransferSyntaxUID = ExplicitVRLittleEndian
        meta.MediaStorageSOPClassUID = CTImageStorage
        meta.MediaStorageSOPInstanceUID = generate_uid()
        ds = FileDataset(str(tmp_path / f"slice-{z}.dcm"), {}, file_meta=meta, preamble=b"\0" * 128)
        ds.SOPClassUID = CTImageStorage
        ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
        ds.StudyInstanceUID, ds.SeriesInstanceUID = study, series
        ds.FrameOfReferenceUID = reference
        ds.PatientName, ds.PatientID = "Synthetic^Phantom", "PHANTOM"
        ds.Modality, ds.StudyDate = "CT", "20261013"
        ds.Rows, ds.Columns = 6, 8
        ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, "MONOCHROME2"
        ds.BitsAllocated = ds.BitsStored = 16
        ds.HighBit, ds.PixelRepresentation = 15, 1
        ds.PixelSpacing = [2, 3]
        ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
        ds.ImagePositionPatient = [10, 20, 30 + z * 4]
        ds.InstanceNumber = 5 - z  # Geometry must override reverse instance numbers.
        ds.RescaleSlope, ds.RescaleIntercept = 2, -1000
        row, col = np.indices((6, 8))
        stored = (z * 100 + row * 10 + col - 100).astype(np.int16)
        ds.PixelData = stored.tobytes()
        ds.save_as(ds.filename, enforce_file_format=True)
        files.append(Path(ds.filename))
        arrays.append(stored.astype(np.float32) * 2 - 1000)
    return {"files": files, "expected": np.stack(arrays), "series": series}
