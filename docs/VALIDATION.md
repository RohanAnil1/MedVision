# Validation record

Date: 2026-10-13. Development host: Windows x86-64, Python 3.10.11, Node 24.13.0.

- `python -m pytest backend/tests -q`: 11 passed. Known synthetic DICOM values validate signed rescaling, volume sorting, MPR, oblique sampling, MIP/MinIP/AIP, duplicate handling, archive restart, storage changes, partial imports, and local API access controls.
- `npm run build`: TypeScript check and production Vite build pass. Local assets include decoder workers and five WASM codecs. Warnings about large chunks and Node-only codec branches remain; compressed image browser tests are still required.
- `npm run test:browser`: one end-to-end test passes using Playwright Chromium 134 with SwiftShader. Real DICOM stack, slice navigation, window preset, rotation, metadata, axial MPR, 3D volume, CPU stack and page reload are exercised. Visible pixel checks prevent a blank canvas from passing. External browser requests are intercepted and rejected; zero are attempted in this scenario.
- `npm run api:types`: OpenAPI and TypeScript declarations generated from the actual API.

This record does not certify clinical use, compressed syntax coverage, all offline workflows, child-process egress, physical GPU performance, packaged installers, Windows 10/11 separately, or macOS. These gates remain open in FEATURES.md.
