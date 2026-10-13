import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from medvision.app import create_app
from medvision.config import Config

with tempfile.TemporaryDirectory() as temporary:
    app = create_app(Config(Path(temporary), "schema-only-" + "a" * 32))
    destination = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
    app.state.jobs.close()
