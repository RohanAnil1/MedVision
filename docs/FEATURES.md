# Feature acceptance ledger

Statuses distinguish source implementation from verified runtime behavior. No full-parity claim is made.

| Requirement | Current evidence / status |
|---|---|
| Isolated React/Vite/TypeScript app | Production build passes |
| Local FastAPI + SQLite | Implemented; API/archive tests pass |
| Authentication, Origin, Host validation | Implemented; hostile request tests pass |
| DICOM files/folders, DICOMDIR | File import tested; generated DICOMDIR media references resolve and import; browser folder workflow acceptance pending |
| Duplicate detection, original preservation, reopen | Automated tests pass |
| Signed pixels and rescale | Analytic phantom tests pass |
| JPEG/JPEG-LS/JPEG2000/RLE | Lossless RLE/JPEG-LS/JPEG2000 synthetic round trips pass backend tests and render visibly with local browser codecs; lossy JPEG fixtures pending |
| Enhanced multiframe geometry | Header geometry test passes; complete enhanced objects pending |
| 2D viewing/window/level/transforms/cine | Stack/navigation/window/rotate pass Chromium test; broader transform and cine tests pending |
| Multi-viewport comparison | Independent viewport selection implemented; synchronization pending |
| Length/angle/Cobb/ROI tools | Analytic length/angle/Cobb/rectangle ROI tests pass; browser length drawing/save passes; other interactive tools need acceptance |
| Annotation persistence | Stack annotation save/restore and measurement panel implemented; length survives browser reload |
| MPR, MIP/MinIP/AIP, oblique | Interactive GPU projections and CPU patient-axis MPR/projections implemented; oblique yaw/pitch/offset controls and PNG export pass browser tests; rotated/tilted acquisition correctness verified analytically; reconstructed-plane annotation persistence pending |
| GPU 3D rendering | Synthetic volume visibly renders in Chromium and native Intel/NVIDIA D3D11 smoke paths; full physical GPU/performance qualification pending |
| Transfer functions/crop/clip | Color presets, scalar threshold, opacity, lighting, sample quality, acquisition-axis crop bounds and arbitrary patient-space clipping implemented; analytic geometry tests and visible pixel/retained-side browser checks pass |
| CPU stack fallback | Hardware capability detection selects CPU when needed; visible CPU stack/MPR/oblique rendering verified in Chromium tests; complete GPU-unavailable workflow and software 3D acceptance pending |
| Software volume rendering | Pending |
| Background processing and cancellation | Import worker/job API implemented; cancellation stress tests pending |
| Progressive volumes/cache/memory limits | Input/volume limits, frontend cache cap, derived-slice cleanup and bounded read-only backend volume cache implemented; cache reuse/invalidation/budget tests pass; progressive loading and aggregate memory stress pending |
| PET-CT fusion/registration/SUV | Pending |
| DSA/time-intensity curves | Pending |
| Modality compatibility beyond CT/MR | Pending fixture acceptance |
| PNG export | Source implemented; acceptance pending |
| Reports/measurement/video/mesh export | Measurement JSON/CSV/PDF implemented; backend export tests and browser PDF download pass; video/mesh pending |
| PACS and local DICOMweb | Disabled; implementation pending |
| Alternative storage | Settings UI and isolated native folder-picker bridge implemented; browser location changes preserve old studies; native picker IPC tested with a mocked dialog result; invalid/unwritable/network-drive paths rejected and old setting preserved; native macOS permissions pending |
| Offline launch/bootstrap | Browser bootstrap tested; exercised stack/MPR/3D/reload with non-loopback browser requests blocked (zero attempted); process/clean-machine tests pending |
| Windows EXE/installer | Unsigned NSIS installer and bundled EXE built; development and packaged EXE launch/stack/volume/isolation smoke pass; packaged launch also passes without Python/Node on PATH; clean-machine installer acceptance pending |
| macOS app/DMG ARM64/Intel | Build scripts/configuration implemented; native validation pending |
| Dependency versions/licenses | Exact direct pins, npm lock, Windows Python 3.10 transitive lock, license inventories generated; macOS locks/publisher license review pending |
| Platform/GPU/performance matrix | Windows CPU benchmark recorded for 128×256×256 CT phantom; native Intel and NVIDIA RTX 5060 D3D11 smoke paths verified; AMD, large-study/multi-GPU performance and macOS qualification pending |

## Release gates

Run the twelve offline workflows in the requirements on each qualified platform with internet blocked but loopback available. Capture app and child-process network activity. Verify installation without development runtimes, archive survival across restart/upgrade, malformed input handling, quantitative tools against phantoms, and all claimed transfer syntaxes. Publish hardware/dataset sizes and benchmark results. No platform or workflow is qualified solely by a build script or source presence.
