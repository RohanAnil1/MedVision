# MEDVISION DICOM VIEWER — CROSS-PLATFORM, FULLY OFFLINE DEVELOPMENT REQUIREMENTS

You are a world-class software architect, medical imaging engineer, full-stack developer, GPU rendering specialist, and professional UI/UX designer.

Build a full-featured RadiAnt-inspired DICOM viewer for personal educational and research use.

The application must run on both **Windows and macOS**, work completely offline, and keep all patient data on the user's computer.

## 1. Supported Operating Systems

### Windows
- Windows 10 and Windows 11
- x86-64 processors
- NVIDIA, AMD, and Intel graphics
- Hardware acceleration where supported

### macOS
- macOS on Apple Silicon (M1, M2, M3, M4, M5, and supported future chips)
- macOS on Intel-based Macs where supported by the selected dependencies
- Metal-backed GPU acceleration through compatible browser graphics APIs
- Optimized native ARM64 dependencies

Both platforms must offer the same core features.

## 2. Fully Offline Operation

**This is a strict and non-negotiable requirement.**

- No cloud computing.
- No external APIs.
- No Google Firebase, Supabase, or AWS.
- No third-party authentication.
- No telemetry or analytics.
- No remote image processing.
- No CDN-hosted scripts, fonts, stylesheets, or libraries.
- No mandatory online activation or license verification.
- No internet connection required to start or operate.
- No patient information transmitted outside the computer.
- No runtime dependency on external servers.
- No automatic updates requiring internet access.

All functionality must work after installation with the internet disconnected.

Any necessary models, codecs, fonts, libraries, and assets must be packaged locally.

Internet access may be used during initial development or dependency installation, but the finished application must be completely self-contained.

## 3. Cross-Platform Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Zustand
- Cornerstone3D
- vtk.js
- ITK-Wasm
- WebGL2
- WebGPU where supported

### Backend
- Python
- FastAPI
- pydicom
- pynetdicom
- NumPy
- SciPy
- SimpleITK
- OpenCV
- SQLite

### Optional local DICOM server
- Orthanc, packaged locally if included

Never require an internet-hosted Orthanc instance.

Use pinned, compatible, stable library versions validated for Windows x86-64, macOS ARM64, and supported macOS Intel configurations.

## 4. Localhost Architecture

The complete application must run on the user's computer.

Frontend:
http://127.0.0.1:3000

Backend:
http://127.0.0.1:8000

All image processing, DICOM parsing, volume reconstruction, study indexing, and export operations must execute locally.

The backend must bind to loopback addresses only.

Do not expose services to the LAN or the internet by default.

Provide protection against unauthorized local API requests, cross-origin attacks, and malicious file input.

## 5. Native Desktop Packaging

In addition to localhost mode, create installable desktop applications.

### Windows
- MedVision.exe
- Windows installer
- Bundled runtime and dependencies
- Local storage directory
- Single-click application launch

### macOS
- MedVision.app
- DMG installer
- Native Apple Silicon build
- Supported Intel build
- Bundled runtime and dependencies
- Standard macOS file selection and folder permissions
- Single-click application launch

Use Tauri 2 or another suitable desktop framework after verifying that its WebView and graphics capabilities support the required medical imaging libraries.

If system WebViews cannot support a required rendering feature consistently, use a compatible bundled rendering engine or provide a documented native fallback.

Package the local backend with the application.

Users must not need to install Python, Node.js, or any development tools.

The packaged application must not download components during first launch.

## 6. Complete RadiAnt-Style Feature Set

Retain all features from the original master prompt, including:

- DICOM file and folder import
- DICOMDIR support
- CT, MRI, PET, X-ray, ultrasound, and other compatible modalities
- Window width and window level
- Zoom, pan, rotate, flip, and inversion
- Smooth stack navigation
- Multi-viewport layouts
- Synchronized study comparison
- Length, angle, area, and ROI measurements
- Cobb angle
- Annotation tools
- Axial, sagittal, and coronal MPR
- Oblique MPR
- MIP, MinIP, and AIP
- Interactive 3D volume rendering
- Adjustable transfer functions
- Volume cropping and clipping
- PET-CT fusion
- DSA image subtraction
- Cine playback
- Time-intensity curves
- DICOM metadata inspection
- Local study archive
- Local PACS connectivity
- DICOMweb connectivity to explicitly configured local servers
- Image, video, measurement, and mesh export

PACS networking is optional and must be explicitly enabled by the user. The viewer itself must function without any network connection.

## 7. Local Storage

Store all imported medical studies on the user's computer.

Use platform-appropriate application data directories.

Windows:
%LOCALAPPDATA%/MedVision/

macOS:
~/Library/Application Support/MedVision/

Use SQLite for metadata indexing.

Allow users to choose an alternative study-storage location.

Never silently upload, synchronize, or share files.

## 8. Performance Optimization

### Windows
- Optimize for NVIDIA RTX GPUs.
- Support AMD and Intel GPUs.
- Use compatible hardware-accelerated rendering.

### macOS
- Optimize for Apple Silicon unified memory.
- Minimize unnecessary image-buffer copies.
- Use compatible GPU APIs and browser rendering paths.
- Handle high-resolution Retina displays correctly.
- Support responsive MPR and volume visualization.

Implement:
- Asynchronous image decoding
- Local image caching
- GPU memory management
- Background processing
- Web Workers
- Progressive volume loading
- Multithreaded local processing where appropriate
- CPU fallbacks
- Memory-aware rendering quality adjustment

Performance must be tested separately on both operating systems.

## 9. Offline Verification

Create automated and manual tests proving that the application functions without internet connectivity.

Test these operations with networking disabled:

1. Launch the application.
2. Import a DICOM study.
3. Navigate CT/MRI slices.
4. Change window/level.
5. Perform accurate measurements.
6. Open multiple viewports.
7. Generate MPR images.
8. Render a 3D volume.
9. Save the study locally.
10. Reopen the stored study.
11. Export images and reports.
12. Close and restart the application.

Verify that no remote connection is attempted during normal offline use.

## 10. Final Deliverables

Produce:

- Complete frontend source code
- Complete backend source code
- Working Windows localhost build
- Working macOS localhost build
- Windows desktop application
- macOS desktop application
- Fully bundled dependencies
- Local SQLite database implementation
- Cross-platform installation instructions
- Windows and macOS build scripts
- Offline operation tests
- DICOM compatibility tests
- GPU rendering tests
- Professional radiology workstation interface

Do not create a UI-only mockup.

Every completed feature must be genuinely implemented and tested.

Do not claim full feature parity until the feature comparison and acceptance tests demonstrate it.

**Final objective:** Create a fast, modern, completely private, fully offline DICOM workstation that provides RadiAnt-style functionality on both Windows and macOS, with localhost and native desktop operation, without depending on any cloud service or external network connection.