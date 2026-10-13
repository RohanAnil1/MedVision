# Validation record

Date: 2026-10-13. Development host: Windows x86-64, Python 3.10.11, Node 24.13.0.

- `python -m pytest backend/tests -q`: 31 passed. Existing import/security/imaging/measurement/reconstruction/cache tests plus rejected storage-location changes preserving the prior setting and mapped-drive rejection before filesystem I/O are verified. The mapped-drive test is Windows-specific.
- `npm run build`: TypeScript check and production Vite build pass. Local assets include decoder workers and five WASM codecs. Warnings about large chunks and Node-only codec branches remain; compressed image browser tests are still required.
- `npm run test:browser`: one end-to-end test passes using Playwright Chromium 134 with software fallback permitted. It exercises the original stack/measurement/export/codec workflow plus GPU projection switching, CPU MPR/MIP/MinIP/AIP, oblique pitch changes and PNG download. Visible pixel checks prevent a blank canvas from passing. External browser requests are intercepted and rejected; zero are attempted in this scenario. Renderer identity is recorded separately by native hardware smoke tests.
- `npm run api:types`: OpenAPI and TypeScript declarations generated from the actual API.
- `node tests/desktop/smoke.mjs`: Electron 44.7 development smoke passes for archive, DICOM stack, 3D volume, and renderer isolation. Temporary synthetic studies are used, not patient data.
- `scripts/build-backend.ps1`: PyInstaller Windows x64 onedir backend build completes. Packaged runtime verification is a separate gate.
- `node tests/desktop/smoke.mjs --packaged`: rebuilt packaged EXE smoke passes for archive, DICOM stack, volume and isolation with PATH restricted to Windows System32. It launches its bundled backend, not the development Python runtime.
- `scripts/licenses.mjs` and `scripts/python-licenses.py`: generate dependency declaration inventories. These are evidence for review, not a completed redistribution-license audit.
- `npm test`: complete local suite passes (backend tests, TypeScript/production build, browser workflow, Electron development smoke). Services release ports 3000 and 8000 after shutdown.
- `npm run package:win`: unsigned Windows x64 NSIS installer built successfully. Initial default resource-editing failed because the toolchain's archive needed symbolic-link privileges; development packaging disables that optional step. Artifact hashes are in windows-build.json. Clean-machine installer acceptance remains pending.
- `scripts/benchmark.py`: a synthetic 128×256×256 signed CT phantom (16.9 MB originals, 32 MiB float32 volume) imported in 0.946 s and reconstructed in 0.251 s on this host. Mean coronal extraction was 0.010 ms and full axial MIP 2.894 ms. These are backend CPU timings, not UI or GPU latency targets.

This record does not certify clinical use, compressed syntax coverage, all offline workflows, child-process egress, physical GPU performance, packaged installers, Windows 10/11 separately, or macOS. These gates remain open in FEATURES.md.

## Patient-space reconstruction and native graphics update

- Frontend analytic test verifies the oblique basis is orthonormal and centered in patient coordinates.
- The API exposes typed volume and reconstruction geometry through generated OpenAPI declarations.
- CPU reconstruction grids preserve calibrated aspect ratios. Projection samples outside the acquired volume are excluded, including from AIP averages.
- Native hardware smoke runs query the actual WebGL renderer: Intel Graphics D3D11 and NVIDIA GeForce RTX 5060 Laptop GPU D3D11. NVIDIA is selected with the process-local high-performance GPU switch. See graphics-windows.json and graphics-windows-discrete.json for recorded capabilities and limits.
- Native smoke now exercises oblique reconstruction and pitch changes in addition to stack, 3D rendering and renderer isolation. Hardware evidence covers one host and a synthetic five-slice phantom, not the full platform or performance matrix.

## Volume display and storage controls update

- Four frontend analytic tests pass, including rotated crop-plane origins/normals, arbitrary clipping-plane reversal, scalar-range validation, transfer-function opacity and the oblique basis.
- Browser tests verify opacity zero removes rendered image pixels, restoring opacity restores the image, cropping reduces the visible region, reset restores it, and reversing clipping moves the visible pixel centroid to the opposite side. Color/sampling controls and all six crop bounds combined with an oblique clipping plane are exercised without page errors or external browser requests.
- Storage settings are changed through the visible dialog before reopening the existing study. API tests verify an unwritable path, relative path, UNC path and simulated mapped drive cannot replace the previous storage setting.
- Native folder-picker IPC is tested by injecting a synthetic dialog result in the test process. This proves the isolated bridge and storage update, not manual Windows/macOS picker behavior or macOS folder permissions.
- Unavailable pointer tools are disabled in CPU reconstruction views; window fields and reconstruction controls remain available. Volume Pan/Zoom selections now bind their actual gestures instead of always rotating.
- A regression test caught vtk.js 36.4.1's fixed six-slot clipping shader: a seventh plane produced an incorrect full image. The viewer now uses vtk.js's supported shader-replacement API to expand the three clipping uniform arrays to seven slots. The final retained-side assertion waits for rendered frames and verifies that six crop faces plus the oblique clipping plane still remove the intended side. This workaround is tied to the pinned vtk.js release and must be revalidated on upgrades.
- Rebuilt packaged EXE smoke passes on Intel and NVIDIA RTX 5060 D3D11, including the native storage bridge and a retained-side pixel-centroid check with all six crop bounds plus the clipping plane enabled. Development runtimes are excluded from the app's PATH in these runs. Updated installer hashes are recorded in windows-build.json.
