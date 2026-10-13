import importlib.metadata
import json
from pathlib import Path

entries = []
for dist in importlib.metadata.distributions():
    metadata = dist.metadata
    licenses = [str(file) for file in (dist.files or []) if any(word in str(file).lower() for word in ("license", "licence", "copying", "notice"))]
    entries.append({"name": metadata["Name"], "version": dist.version, "license": metadata.get("License-Expression") or metadata.get("License") or "UNKNOWN",
                    "classifiers": [c for c in metadata.get_all("Classifier", []) if c.startswith("License")], "license_files": licenses})
entries.sort(key=lambda item: item["name"].lower())
target = Path(__file__).resolve().parents[1] / "docs" / "python-licenses.json"
target.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
print(f"Recorded {len(entries)} Python distribution license declarations; publisher review remains required.")
