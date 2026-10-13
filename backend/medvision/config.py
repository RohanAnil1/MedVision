import os
import sys
from dataclasses import dataclass
from pathlib import Path


def default_data_dir() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "MedVision"
    return Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local" / "share")) / "MedVision"


@dataclass(frozen=True)
class Config:
    data_dir: Path
    token: str
    max_file_bytes: int = 512 * 1024 * 1024
    max_decoded_bytes: int = 1024 * 1024 * 1024
    max_volume_bytes: int = 1024 * 1024 * 1024
    origin: str = "http://127.0.0.1:3000"

    @classmethod
    def environment(cls):
        token = os.environ.get("MEDVISION_TOKEN", "")
        if len(token) < 32:
            raise RuntimeError("Start MedVision through its launcher (missing launch secret).")
        return cls(Path(os.environ.get("MEDVISION_DATA_DIR", default_data_dir())), token)
