from pathlib import Path

import pydicom
from pydicom.fileset import FileSet


def test_real_dicomdir_references_import_locally(archive, phantom, tmp_path):
    fileset = FileSet()
    for path in phantom["files"]:
        ds = pydicom.dcmread(path)
        ds.StudyID, ds.StudyTime, ds.SeriesNumber = "PHANTOM", "120000", 1
        fileset.add(ds)
    directory = tmp_path / "dicom-media"
    fileset.write(directory)
    result = archive.import_file(directory / "DICOMDIR")
    assert result["status"] == "directory"
    assert len(result["references"]) == 5
    for relative in result["references"]:
        referenced = (directory / Path(relative)).resolve()
        assert referenced.is_relative_to(directory.resolve())
        assert archive.import_file(referenced)["status"] == "imported"
    assert archive.studies()[0]["instance_count"] == 5
