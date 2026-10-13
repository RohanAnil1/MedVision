# MedVision

An independent, local-only DICOM workstation for education and research. The original MyRadiologyHub portal is outside this application's repository and runtime.

**Development status:** real DICOM import, local SQLite archiving, protected APIs, Cornerstone stack tools, backend MPR/projections/oblique resampling, and frontend GPU volume integration are implemented. Full feature parity and cross-platform qualification are not complete. See [feature status](docs/FEATURES.md).

## Development setup

Development downloads dependencies. Installed distributions must not download any components.

Windows PowerShell (Python 3.10+, Node 22.12+):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
npm.cmd ci
npm.cmd run build
npm.cmd start
```

macOS (native Python and Node matching the build architecture):

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
npm ci
npm run build
npm start
```

The localhost launcher opens a temporary local launch page. Click **Open MedVision workstation** to create a browser session. The single-use launch credential travels in a POST body, never in a URL. Services listen only on `127.0.0.1:3000` and `127.0.0.1:8000`. Stop the launcher with Ctrl+C. `npm run desktop` launches Electron against the same built frontend and local backend.

Import a DICOM folder or files; then select a series in the archive. Stack tools use actual DICOM geometry and decoded pixels. Multiple viewports can show different series. MPR/3D require consistent spatial geometry; malformed, irregular and tilted series produce explicit errors. CPU stack mode is available; software 3D rendering is still pending.

The saved-measurements toolbar button opens persisted stack measurements and CSV/JSON/PDF export. Measurements are calculated locally against their source images; missing calibration uses pixel units. Annotation persistence on reconstructed planes remains pending.

The archive defaults to `%LOCALAPPDATA%/MedVision/` on Windows or `~/Library/Application Support/MedVision/` on macOS. `MEDVISION_DATA_DIR` overrides it for development/testing. Archive storage can be changed through the local settings API; existing studies stay where they were imported. Data is not uploaded. PACS remains disabled until its implementation and acceptance tests are complete.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm.cmd run build
npm.cmd run api:types
```

The imaging tests create synthetic CT data with known pixel values, geometry, and spacing. Browser tests exercise the production build and monitor outbound browser requests. Passing these tests alone does not qualify every GPU, Windows version, or macOS architecture.

## Desktop builds

Windows:

```powershell
.\scripts\build-backend.ps1
npm.cmd run package:win
```

macOS (run separately on ARM64 and Intel build hosts):

```sh
sh scripts/build-backend.sh
npm run package:mac
```

The macOS packaging script checks Python/Node architecture agreement, rebuilds the backend and frontend, and produces only the current host architecture's DMG. Run it on ARM64 and Intel hosts separately. Code signing and notarization require the publisher's credentials and are release gates. Native macOS builds remain unverified until their qualification records are recorded.

## Privacy and security

No cloud services, telemetry, remote assets, mandatory updates, or online activation are included. The backend requires a random launch secret, validates Host and Origin, and does not log HTTP access requests. Electron uses a sandboxed renderer, isolated preload, narrow export IPC, and blocks non-local renderer requests. DICOM is untrusted input; broader decoder isolation and resource-pressure testing remain pending.

## License

MIT for MedVision source. Bundled third-party packages have their own licenses; a dependency license inventory is required before distributing installers.
