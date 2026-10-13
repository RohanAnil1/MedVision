import csv
import io
import math

import cv2
import numpy as np
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .archive import ImagingError
from .imaging import frame_geometry


def angle(a, b):
    lengths = np.linalg.norm(a) * np.linalg.norm(b)
    if lengths < 1e-8:
        raise ImagingError("Angle requires nonzero line segments.")
    return float(np.degrees(np.arccos(np.clip(np.dot(a, b) / lengths, -1, 1))))


def calculate(tool, points, units, ds, image, frame):
    p = np.array(points, dtype=float)
    expected = {"length": 2, "angle": 3, "cobb": 4, "rectangle": 4, "ellipse": 4}
    if tool in expected and len(p) != expected[tool]:
        raise ImagingError(f"{tool} requires {expected[tool]} points.")
    if tool == "polygon" and len(p) < 3:
        raise ImagingError("A polygon requires at least three points.")
    geom = frame_geometry(ds, frame)
    if units == "mm" and geom["spacing"] is None:
        raise ImagingError("Physical calibration is unavailable; use pixel units.")
    if tool == "text":
        return {}
    if tool == "length":
        return {"length": float(np.linalg.norm(p[1] - p[0])), "unit": units}
    if tool == "angle":
        return {"angle": angle(p[0] - p[1], p[2] - p[1]), "unit": "degrees"}
    if tool == "cobb":
        raw = angle(p[1] - p[0], p[3] - p[2])
        return {"angle": min(raw, 180 - raw), "unit": "degrees", "definition": "acute angle between the two lines"}
    if image.ndim != 2:
        raise ImagingError("Quantitative ROI statistics require monochrome pixels.")
    if units == "mm":
        if geom["position"] is None or geom["orientation"] is None:
            raise ImagingError("Patient-space geometry is unavailable.")
        directions = np.array(geom["orientation"])
        xaxis, yaxis = directions[:3], directions[3:]
        delta = p - np.array(geom["position"])
        if np.max(np.abs(delta @ np.cross(xaxis, yaxis))) > 0.1:
            raise ImagingError("ROI points do not lie in the referenced image plane.")
        xy = np.column_stack((delta @ xaxis / geom["spacing"][1], delta @ yaxis / geom["spacing"][0]))
        scale = float(geom["spacing"][0] * geom["spacing"][1])
    else:
        xy, scale = p[:, :2], 1.0
    rows, columns = image.shape
    if np.any(xy[:, 0] < -0.5) or np.any(xy[:, 0] > columns - 0.5) or np.any(xy[:, 1] < -0.5) or np.any(xy[:, 1] > rows - 0.5):
        raise ImagingError("ROI extends outside the referenced image.")
    mask = np.zeros(image.shape, dtype=np.uint8)
    if tool == "ellipse":
        center = xy.mean(axis=0)
        a, b = (xy[1] - xy[0]) / 2, (xy[3] - xy[2]) / 2
        matrix = np.column_stack((a, b))
        if abs(np.linalg.det(matrix)) < 1e-8:
            raise ImagingError("Ellipse axes are degenerate.")
        y, x = np.indices(image.shape)
        normalized = np.linalg.solve(matrix, np.vstack((x.ravel() - center[0], y.ravel() - center[1])))
        mask = (np.sum(normalized ** 2, axis=0) <= 1 + 1e-8).reshape(image.shape)
        area = float(math.pi * abs(np.linalg.det(matrix)) * scale)
    else:
        if tool == "rectangle":
            # Cornerstone handles: top-left, top-right, bottom-left, bottom-right.
            xy = xy[[0, 1, 3, 2]]
        area = float(abs(np.dot(xy[:, 0], np.roll(xy[:, 1], 1)) - np.dot(xy[:, 1], np.roll(xy[:, 0], 1))) / 2 * scale)
        cv2.fillPoly(mask, [np.rint(xy).astype(np.int32)], 1)
    selected = image[mask.astype(bool)]
    if not selected.size or not np.all(np.isfinite(selected)):
        raise ImagingError("ROI contains no valid pixels.")
    return {"area": area, "area_unit": units + "2", "pixel_count": int(selected.size),
            "mean": float(np.mean(selected, dtype=np.float64)), "std": float(np.std(selected, dtype=np.float64)),
            "min": float(selected.min()), "max": float(selected.max()), "sampling": "pixel centers; polygon vertices rounded to nearest center"}


def measurement_csv(annotations):
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["id", "instance_id", "frame", "tool", "length", "angle", "area", "unit", "mean", "std", "min", "max", "text"])
    for item in annotations:
        result = item.get("result", {})
        # Prevent spreadsheet formula execution when exported strings are opened in Excel.
        cells = [item["id"], item["instance_id"], item["frame"], item["tool"], result.get("length", ""), result.get("angle", ""),
                 result.get("area", ""), result.get("unit", result.get("area_unit", "")), result.get("mean", ""), result.get("std", ""), result.get("min", ""), result.get("max", ""), item.get("text", "")]
        writer.writerow(["'" + cell if isinstance(cell, str) and cell.lstrip().startswith(("=", "+", "-", "@")) else cell for cell in cells])
    return output.getvalue().encode("utf-8-sig")


def measurement_pdf(series_uid, annotations):
    out = io.BytesIO()
    pdf = canvas.Canvas(out, pagesize=A4)
    pdf.setTitle("MedVision measurement report")
    width, height = A4
    y = height - 50
    def line(text, bold=False):
        nonlocal y
        if y < 55:
            pdf.showPage(); y = height - 50
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", 10)
        # Wrap without allowing markup or HTML interpretation.
        text = str(text)
        while text:
            piece = text[:95]
            pdf.drawString(40, y, piece)
            text = text[95:]; y -= 15
            if y < 55 and text:
                pdf.showPage(); y = height - 50
    line("MedVision measurement report", True)
    line("Educational and research use. Values require source-image verification.")
    line("Series: " + series_uid)
    line("Measurement count: " + str(len(annotations)))
    y -= 12
    for item in annotations:
        line(f"{item['tool']} | frame {item['frame'] + 1} | {item['id']}", True)
        for key, val in item.get("result", {}).items():
            line(f"  {key}: {val:.6g}" if isinstance(val, float) else f"  {key}: {val}")
        if item.get("text"):
            line("  " + item["text"])
        y -= 10
    pdf.save()
    return out.getvalue()
