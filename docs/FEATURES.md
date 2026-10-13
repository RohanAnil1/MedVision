# Feature acceptance ledger

Statuses distinguish source implementation from verified runtime behavior. No full-parity claim is made.

| Requirement | Current evidence / status |
|---|---|
| Isolated React/Vite/TypeScript app | Production build passes |
| Local FastAPI + SQLite | Implemented; API/archive tests pass |
| Authentication, Origin, Host validation | Implemented; hostile request tests pass |
| DICOM files/folders, DICOMDIR | File import tested; directory references validated; real DICOMDIR fixtures pending |
| Duplicate detection, original preservation, reopen | Automated tests pass |
| Signed pixels and rescale | Analytic phantom tests pass |
| JPEG/JPEG-LS/JPEG2000/RLE | Dependencies bundled in source configuration; compressed fixtures pending |
| Enhanced multiframe geometry | Header geometry test passes; complete enhanced objects pending |
| 2D viewing/window/level/transforms/cine | Stack/navigation/window/rotate pass Chromium test; broader transform and cine tests pending |
| Multi-viewport comparison | Independent viewport selection implemented; synchronization pending |
| Length/angle/Cobb/ROI tools | Cornerstone tools connected; accuracy and persistence UI tests pending |
| Annotation persistence | API implemented; frontend restore/export integration pending |
| MPR, MIP/MinIP/AIP, oblique | Backend analytic phantom tests pass; interactive oblique/projection UI pending |
| GPU 3D rendering | Synthetic volume visibly renders in Chromium/SwiftShader; physical GPU qualification pending |
| Transfer functions/crop/clip | Initial CT transfer function implemented; interactive controls pending |
| CPU stack fallback | Visible pixel rendering verified in Chromium test |
| Software volume rendering | Pending |
| Background processing and cancellation | Import worker/job API implemented; cancellation stress tests pending |
| Progressive volumes/cache/memory limits | Input/volume limits and frontend cache cap implemented; progressive loading pending |
| PET-CT fusion/registration/SUV | Pending |
| DSA/time-intensity curves | Pending |
| Modality compatibility beyond CT/MR | Pending fixture acceptance |
| PNG export | Source implemented; acceptance pending |
| Reports/measurement/video/mesh export | Pending |
| PACS and local DICOMweb | Disabled; implementation pending |
| Alternative storage | API implemented and tested; settings UI pending |
| Offline launch/bootstrap | Browser bootstrap tested; exercised stack/MPR/3D/reload with non-loopback browser requests blocked (zero attempted); process/clean-machine tests pending |
| Windows EXE/installer | Build scripts/configuration implemented; artifact validation pending |
| macOS app/DMG ARM64/Intel | Build scripts/configuration implemented; native validation pending |
| Dependency versions/licenses | Exact direct pins and npm lock; complete Python lock/license audit pending |
| Platform/GPU/performance matrix | Pending actual hardware qualification |

## Release gates

Run the twelve offline workflows in the requirements on each qualified platform with internet blocked but loopback available. Capture app and child-process network activity. Verify installation without development runtimes, archive survival across restart/upgrade, malformed input handling, quantitative tools against phantoms, and all claimed transfer syntaxes. Publish hardware/dataset sizes and benchmark results. No platform or workflow is qualified solely by a build script or source presence.
