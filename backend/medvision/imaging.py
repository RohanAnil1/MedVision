import io
import math
from pathlib import Path

import numpy as np
import pydicom
from PIL import Image
from scipy.ndimage import map_coordinates

from .archive import ImagingError


def frame_geometry(ds, frame=0):
    position = getattr(ds, "ImagePositionPatient", None)
    orientation = getattr(ds, "ImageOrientationPatient", None)
    spacing = getattr(ds, "PixelSpacing", None)
    slope, intercept = float(getattr(ds, "RescaleSlope", 1)), float(getattr(ds, "RescaleIntercept", 0))
    groups = []
    shared = getattr(ds, "SharedFunctionalGroupsSequence", [])
    if shared:
        groups.append(shared[0])
    per_frame = getattr(ds, "PerFrameFunctionalGroupsSequence", [])
    if per_frame:
        groups.append(per_frame[frame])
    for group in groups:
        for seq, attr in (("PlanePositionSequence", "ImagePositionPatient"), ("PlaneOrientationSequence", "ImageOrientationPatient"), ("PixelMeasuresSequence", "PixelSpacing")):
            items = getattr(group, seq, [])
            if items:
                v = getattr(items[0], attr, None)
                if attr == "ImagePositionPatient":
                    position = v
                elif attr == "ImageOrientationPatient":
                    orientation = v
                else:
                    spacing = v
        transform = getattr(group, "PixelValueTransformationSequence", [])
        if transform:
            slope, intercept = float(transform[0].RescaleSlope), float(transform[0].RescaleIntercept)
    return {
        "position": list(map(float, position)) if position is not None else None,
        "orientation": list(map(float, orientation)) if orientation is not None else None,
        "spacing": list(map(float, spacing)) if spacing is not None else None,
        "slope": slope, "intercept": intercept,
    }


def pixels(path: Path, frame=0):
    try:
        ds = pydicom.dcmread(path)
        count = int(getattr(ds, "NumberOfFrames", 1))
        if frame < 0 or frame >= count:
            raise ImagingError("Frame index is out of range.")
        array = pydicom.pixels.pixel_array(ds, index=frame)
        geometry = frame_geometry(ds, frame)
        if int(ds.SamplesPerPixel) == 1:
            # Modality LUT takes precedence over rescale; VOI stays a view operation.
            if getattr(ds, "ModalityLUTSequence", None):
                array = pydicom.pixels.apply_modality_lut(array, ds).astype(np.float32)
            else:
                array = array.astype(np.float32) * geometry["slope"] + geometry["intercept"]
        return ds, np.ascontiguousarray(array), geometry
    except ImagingError:
        raise
    except Exception as exc:
        raise ImagingError("Cannot decode this transfer syntax or image payload.") from exc


def window(array, center=None, width=None, invert=False):
    if array.ndim == 3:
        return np.clip(array, 0, 255).astype(np.uint8)
    finite = array[np.isfinite(array)]
    if not finite.size:
        raise ImagingError("Image has no finite pixels.")
    if center is None or width is None:
        lo, hi = np.percentile(finite, [1, 99])
        width = max(float(hi - lo), 1)
        center = float((hi + lo) / 2)
    if not math.isfinite(center) or not math.isfinite(width) or width < 1:
        raise ImagingError("Window width must be finite and at least one.")
    if width == 1:
        result = (array > center - 0.5).astype(np.uint8) * 255
    else:
        result = np.clip(((array - (center - 0.5)) / (width - 1) + 0.5) * 255, 0, 255).astype(np.uint8)
    return 255 - result if invert else result


def png(array):
    out = io.BytesIO()
    Image.fromarray(array).save(out, format="PNG")
    return out.getvalue()


def build_volume(archive, series_uid):
    instances = archive.instances(series_uid)
    if not instances:
        raise ImagingError("Series is empty.")
    estimated = sum(i["rows"] * i["columns"] * i["frames"] * 4 for i in instances)
    if estimated * 2 > archive.config.max_volume_bytes:
        raise ImagingError("Volume exceeds the configured memory budget.")
    references = []
    geometries = []
    shape = None
    frame_of_reference = set()
    # Validate headers and all frames before allocating/decompressing a volume.
    for instance in instances:
        record = archive.instance(instance["id"])
        ds = pydicom.dcmread(record["path"], stop_before_pixels=True)
        if int(ds.SamplesPerPixel) != 1:
            raise ImagingError("Volume reconstruction requires monochrome images.")
        frame_of_reference.add(str(getattr(ds, "FrameOfReferenceUID", "")))
        this_shape = (int(ds.Rows), int(ds.Columns))
        if shape is not None and shape != this_shape:
            raise ImagingError("Inconsistent image dimensions.")
        shape = this_shape
        for frame in range(int(getattr(ds, "NumberOfFrames", 1))):
            geom = frame_geometry(ds, frame)
            if any(geom[k] is None for k in ("position", "orientation", "spacing")):
                raise ImagingError("Patient geometry is missing; this series cannot form a volume.")
            references.append((record["path"], frame))
            geometries.append(geom)
    if len(frame_of_reference) != 1:
        raise ImagingError("Mixed frames of reference.")
    if len(references) < 2:
        raise ImagingError("At least two spatial slices are required.")
    first = geometries[0]
    orientation = np.array(first["orientation"])
    x_axis, y_axis = orientation[:3], orientation[3:]
    if not np.all(np.isfinite(orientation)) or not np.allclose([np.linalg.norm(x_axis), np.linalg.norm(y_axis), np.dot(x_axis, y_axis)], [1, 1, 0], atol=1e-4):
        raise ImagingError("Invalid direction cosines.")
    normal = np.cross(x_axis, y_axis)
    spacing = np.array(first["spacing"])
    if spacing.shape != (2,) or not np.all(np.isfinite(spacing)) or np.any(spacing <= 0):
        raise ImagingError("Invalid pixel spacing.")
    for geom in geometries:
        if not np.allclose(geom["orientation"], orientation, atol=1e-4) or not np.allclose(geom["spacing"], spacing, atol=1e-4):
            raise ImagingError("Inconsistent orientation or spacing.")
        if not np.all(np.isfinite(geom["position"])):
            raise ImagingError("Invalid patient position.")
    positions = np.array([g["position"] for g in geometries])
    order = np.argsort(positions @ normal)
    positions = positions[order]
    distances = np.diff(positions @ normal)
    dz = float(np.median(distances))
    if dz <= 1e-4 or not np.allclose(distances, dz, rtol=0.01, atol=0.01):
        raise ImagingError("Duplicate, missing or irregularly spaced slices; resampling is required.")
    residual = positions - positions[0] - np.outer(np.arange(len(order)) * dz, normal)
    if np.max(np.abs(residual)) > 0.05:
        raise ImagingError("Tilted or displaced slice origins require explicit resampling.")
    volume = np.empty((len(order), *shape), dtype=np.float32)
    for z, idx in enumerate(order):
        volume[z] = pixels(Path(references[idx][0]), references[idx][1])[1]
    return volume, {"origin": positions[0].tolist(), "direction": [*x_axis.tolist(), *y_axis.tolist(), *normal.tolist()],
                    "spacing": [float(spacing[1]), float(spacing[0]), dz], "dimensions": [shape[1], shape[0], len(order)],
                    "frame_of_reference_uid": next(iter(frame_of_reference))}


def reconstruct(volume, plane, index, projection="slice"):
    axes = {"axial": 0, "coronal": 1, "sagittal": 2}
    if plane not in axes:
        raise ImagingError("Unknown reconstruction plane.")
    axis = axes[plane]
    if projection == "slice":
        if not 0 <= index < volume.shape[axis]:
            raise ImagingError("Slice index is out of range.")
        return np.take(volume, index, axis=axis)
    if projection not in ("mip", "minip", "aip"):
        raise ImagingError("Unknown projection mode.")
    return {"mip": np.max, "minip": np.min, "aip": np.mean}[projection](volume, axis=axis)


def oblique(volume, geometry, origin, u, v, shape, spacing):
    u, v, origin = np.array(u, dtype=float), np.array(v, dtype=float), np.array(origin, dtype=float)
    if not np.all(np.isfinite([*u, *v, *origin])) or not np.allclose([np.linalg.norm(u), np.linalg.norm(v), np.dot(u, v)], [1, 1, 0], atol=1e-4):
        raise ImagingError("Oblique axes must be finite orthonormal vectors.")
    direction = np.array(geometry["direction"]).reshape(3, 3).T
    y, x = np.indices(shape, dtype=float)
    patient = origin[:, None, None] + u[:, None, None] * x * spacing[1] + v[:, None, None] * y * spacing[0]
    ijk = np.einsum("ij,jhw->ihw", direction.T, patient - np.array(geometry["origin"])[:, None, None])
    ijk /= np.array(geometry["spacing"])[:, None, None]
    return map_coordinates(volume, ijk[::-1], order=1, mode="constant", cval=float(volume.min()))


def patient_plane_geometry(geometry, plane):
    axes = {"axial": (0, 1, 2), "coronal": (0, 2, 1), "sagittal": (1, 2, 0)}
    if plane not in axes:
        raise ImagingError("Unknown reconstruction plane.")
    direction = np.array(geometry["direction"]).reshape(3, 3).T
    dimensions, spacing = np.array(geometry["dimensions"]), np.array(geometry["spacing"])
    corners = np.array([[x, y, z] for x in (0, dimensions[0]-1) for y in (0, dimensions[1]-1) for z in (0, dimensions[2]-1)])
    world = (corners * spacing) @ direction.T + geometry["origin"]
    minimum, maximum = world.min(axis=0), world.max(axis=0)
    # Effective sampling distance of the acquisition lattice along each patient axis.
    step = 1 / np.sqrt(np.sum((direction.T / spacing[:, None]) ** 2, axis=0))
    sizes = np.ceil((maximum - minimum) / step - 1e-6).astype(int) + 1
    x, y, z = axes[plane]
    if int(sizes[x]) * int(sizes[y]) > 4 * 1024 * 1024 or sizes[z] > 10000:
        raise ImagingError("Reconstruction grid exceeds the processing budget.")
    return {"plane": plane, "origin": minimum.tolist(), "u": np.eye(3)[x].tolist(), "v": np.eye(3)[y].tolist(),
            "normal_axis": z, "rows": int(sizes[y]), "columns": int(sizes[x]), "slice_count": int(sizes[z]),
            "spacing": [float(step[y]), float(step[x])], "slice_spacing": float(step[z])}


def patient_reconstruction(volume, geometry, plane, index=0, projection="slice"):
    grid = patient_plane_geometry(geometry, plane)
    if projection not in ("slice", "mip", "minip", "aip"):
        raise ImagingError("Unknown projection mode.")
    if not 0 <= index < grid["slice_count"]:
        raise ImagingError("Slice index is out of range.")
    shape = (grid["rows"], grid["columns"])
    direction = np.array(geometry["direction"]).reshape(3, 3).T
    y, x = np.indices(shape)
    base = np.array(grid["origin"])[:, None, None] + np.array(grid["u"])[:, None, None] * x * grid["spacing"][1] + np.array(grid["v"])[:, None, None] * y * grid["spacing"][0]
    samples = [index] if projection == "slice" else range(grid["slice_count"])
    if projection == "mip":
        result = np.full(shape, -np.inf, dtype=np.float32)
    elif projection == "minip":
        result = np.full(shape, np.inf, dtype=np.float32)
    else:
        result = np.zeros(shape, dtype=np.float64)
    counts = np.zeros(shape, dtype=np.uint16)
    for sample in samples:
        world = base.copy()
        world[grid["normal_axis"]] += sample * grid["slice_spacing"]
        ijk = np.einsum("ij,jhw->ihw", direction.T, world - np.array(geometry["origin"])[:, None, None]) / np.array(geometry["spacing"])[:, None, None]
        valid = np.all((ijk >= -1e-5) & (ijk <= (np.array(geometry["dimensions"])-1)[:, None, None] + 1e-5), axis=0)
        ijk = np.clip(ijk, 0, (np.array(geometry["dimensions"])-1)[:, None, None])
        image = map_coordinates(volume, ijk[::-1], order=1, mode="nearest")
        if projection == "mip":
            np.maximum(result, np.where(valid, image, -np.inf), out=result)
        elif projection == "minip":
            np.minimum(result, np.where(valid, image, np.inf), out=result)
        else:
            result += np.where(valid, image, 0)
        counts += valid.astype(np.uint16)
    if projection == "aip":
        np.divide(result, counts, out=result, where=counts > 0)
    result[counts == 0] = float(volume.min())
    return result.astype(np.float32), grid
