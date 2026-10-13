import numpy as np
import pydicom
import pytest
from pydicom.dataset import Dataset
from pydicom.sequence import Sequence

from medvision.archive import Archive, ImagingError
from medvision.imaging import build_volume, frame_geometry, oblique, pixels, reconstruct, window


def test_archive_originals_duplicates_and_restart(archive, config, phantom):
    first = archive.import_file(phantom["files"][0])
    assert first["status"] == "imported"
    assert archive.import_file(phantom["files"][0])["status"] == "duplicate"
    reopened = Archive(config)
    assert reopened.studies()[0]["instance_count"] == 1
    assert open(reopened.instance(first["id"])["path"], "rb").read() == phantom["files"][0].read_bytes()


def test_signed_rescaled_pixels(phantom):
    _, actual, geometry = pixels(phantom["files"][0])
    np.testing.assert_array_equal(actual, phantom["expected"][0])
    assert geometry["spacing"] == [2, 3]


def test_geometry_sort_and_projections(archive, phantom):
    for path in reversed(phantom["files"]):
        archive.import_file(path)
    volume, geometry = build_volume(archive, phantom["series"])
    np.testing.assert_array_equal(volume, phantom["expected"])
    assert geometry["spacing"] == [3, 2, 4]
    assert geometry["origin"] == [10, 20, 30]
    np.testing.assert_array_equal(reconstruct(volume, "coronal", 2), phantom["expected"][:, 2, :])
    np.testing.assert_array_equal(reconstruct(volume, "sagittal", 3), phantom["expected"][:, :, 3])
    for mode, reducer in (("mip", np.max), ("minip", np.min), ("aip", np.mean)):
        np.testing.assert_array_equal(reconstruct(volume, "axial", 0, mode), reducer(phantom["expected"], axis=0))
    sampled = oblique(volume, geometry, [10, 20, 38], [1, 0, 0], [0, 1, 0], (6, 8), (2, 3))
    np.testing.assert_allclose(sampled, phantom["expected"][2], atol=1e-5)


def test_irregular_geometry_is_rejected(archive, phantom):
    ds = pydicom.dcmread(phantom["files"][2])
    ds.ImagePositionPatient[2] += 1
    ds.save_as(phantom["files"][2], enforce_file_format=True)
    for path in phantom["files"]:
        archive.import_file(path)
    with pytest.raises(ImagingError, match="irregularly"):
        build_volume(archive, phantom["series"])


def test_conflicting_uid_is_rejected(archive, phantom):
    path = phantom["files"][0]
    archive.import_file(path)
    ds = pydicom.dcmread(path)
    ds.PatientID = "DIFFERENT"
    ds.save_as(path, enforce_file_format=True)
    with pytest.raises(ImagingError, match="Conflicting"):
        archive.import_file(path)


def test_dicomdir_traversal():
    ds, record = Dataset(), Dataset()
    record.ReferencedFileID = ["..", "secret"]
    ds.DirectoryRecordSequence = Sequence([record])
    with pytest.raises(ImagingError, match="Unsafe"):
        Archive.directory_references(ds)


def test_window_dicom_linear_and_inversion():
    actual = window(np.array([-1, 0, 1], dtype=float), 0.5, 3)
    np.testing.assert_array_equal(actual, [0, 127, 255])
    np.testing.assert_array_equal(window(np.array([-1, 0, 1]), 0.5, 3, True), 255 - actual)
    with pytest.raises(ImagingError):
        window(np.zeros((2, 2)), 0, float("nan"))


def test_enhanced_per_frame_geometry():
    ds, shared, measure, orient = Dataset(), Dataset(), Dataset(), Dataset()
    measure.PixelSpacing = [0.5, 0.6]
    orient.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
    shared.PixelMeasuresSequence = Sequence([measure])
    shared.PlaneOrientationSequence = Sequence([orient])
    ds.SharedFunctionalGroupsSequence = Sequence([shared])
    frames = []
    for z in (0, 2):
        frame, position = Dataset(), Dataset()
        position.ImagePositionPatient = [0, 0, z]
        frame.PlanePositionSequence = Sequence([position])
        frames.append(frame)
    ds.PerFrameFunctionalGroupsSequence = Sequence(frames)
    assert frame_geometry(ds, 1)["position"] == [0, 0, 2]
    assert frame_geometry(ds, 1)["spacing"] == [0.5, 0.6]
