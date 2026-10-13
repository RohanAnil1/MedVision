from typing import Literal
from pydantic import BaseModel


class InstanceResponse(BaseModel):
    id: str
    study_uid: str
    series_uid: str
    sop_uid: str
    sop_class_uid: str
    patient_name: str
    patient_id: str
    study_date: str
    study_description: str
    series_description: str
    modality: str
    instance_number: int
    rows: int
    columns: int
    frames: int
    samples: int
    photometric: str
    position: list[float] | None
    orientation: list[float] | None
    spacing: list[float] | None
    window_center: str | list[str] | None
    window_width: str | list[str] | None
    transfer_syntax: str
    frame_of_reference_uid: str


class SeriesResponse(BaseModel):
    series_uid: str
    description: str
    modality: str
    instance_count: int
    frame_count: int
    first_instance_id: str


class StudyResponse(BaseModel):
    study_uid: str
    patient_name: str
    patient_id: str
    study_date: str
    study_description: str
    instance_count: int
    series: list[SeriesResponse]


class ImportErrorResponse(BaseModel):
    file: str
    message: str


class ImportResult(BaseModel):
    imported: int
    duplicates: int
    errors: list[ImportErrorResponse]


class JobResponse(BaseModel):
    id: str
    kind: str
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    progress: float
    result: ImportResult | None
    error: str | None


class SettingsResponse(BaseModel):
    storage_path: str
    networking_enabled: bool
    max_volume_bytes: int


class ReconstructionGridResponse(BaseModel):
    plane: Literal["axial", "coronal", "sagittal"]
    origin: tuple[float, float, float]
    u: tuple[float, float, float]
    v: tuple[float, float, float]
    normal_axis: int
    rows: int
    columns: int
    slice_count: int
    spacing: tuple[float, float]
    slice_spacing: float


class VolumeGeometryResponse(BaseModel):
    origin: tuple[float, float, float]
    direction: list[float]
    spacing: tuple[float, float, float]
    dimensions: tuple[int, int, int]
    frame_of_reference_uid: str
    reconstruction: ReconstructionGridResponse
