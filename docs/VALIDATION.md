# Validation record

Date: 2026-10-13. Development host: Windows x86-64, Python 3.10.11, Node 24.13.0.

- `python -m pytest backend/tests -q`: 24 passed. Known synthetic DICOM values validate signed rescaling, volume sorting, MPR, oblique sampling, MIP/MinIP/AIP, duplicate handling, archive restart, storage changes, partial imports, local API access controls, calibrated length/angles/ROI, exports, real generated DICOMDIR media, portable-path rejection, and RLE/JPEG-LS/JPEG2000 lossless round trips.
- `npm run build`: TypeScript check and production Vite build pass. Local assets include decoder workers and five WASM codecs. Warnings about large chunks and Node-only codec branches remain; compressed image browser tests are still required.
- `npm run test:browser`: one end-to-end test passes using Playwright Chromium 134 with SwiftShader. Real DICOM stack, slice navigation, window preset, rotation, metadata, length drawing/persistence, PDF download, axial MPR, 3D volume, CPU stack, compressed RLE/JPEG-LS/JPEG2000 stacks, and page reload are exercised. Visible pixel checks prevent a blank canvas from passing. External browser requests are intercepted and rejected; zero are attempted in this scenario.
- `npm run api:types`: OpenAPI and TypeScript declarations generated from the actual API.
- `node tests/desktop/smoke.mjs`: Electron 44.7 development smoke passes for archive, DICOM stack, 3D volume, and renderer isolation. Temporary synthetic studies are used, not patient data.
- `scripts/build-backend.ps1`: PyInstaller Windows x64 onedir backend build completes. Packaged runtime verification is a separate gate.
- `node tests/desktop/smoke.mjs --packaged`: rebuilt packaged EXE smoke passes for archive, DICOM stack, volume and isolation with PATH restricted to Windows System32. It launches its bundled backend, not the development Python runtime.
- `scripts/licenses.mjs` and `scripts/python-licenses.py`: generate dependency declaration inventories. These are evidence for review, not a completed redistribution-license audit.
- `npm test`: complete local suite passes (backend tests, TypeScript/production build, browser workflow, Electron development smoke). Services release ports 3000 and 8000 after shutdown.
- `npm run package:win`: unsigned Windows x64 NSIS installer built successfully. Initial default resource-editing failed because the toolchain's archive needed symbolic-link privileges; development packaging disables that optional step. Artifact hashes are in windows-build.json. Clean-machine installer acceptance remains pending.
- `scripts/benchmark.py`: a synthetic 128×256×256 signed CT phantom (16.9 MB originals, 32 MiB float32 volume) imported in 0.946 s and reconstructed in 0.251 s on this host. Mean coronal extraction was 0.010 ms and full axial MIP 2.894 ms. These are backend CPU timings, not UI or GPU latency targets.

This record does not certify clinical use, compressed syntax coverage, all offline workflows, child-process egress, physical GPU performance, packaged installers, Windows 10/11 separately, or macOS. These gates remain open in FEATURES.md.
