$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & .\.venv\Scripts\python.exe -m PyInstaller --noconfirm --onedir --name medvision-backend --paths backend --collect-all pydicom --collect-all pylibjpeg --collect-all libjpeg --collect-all openjpeg --collect-all jpeg_ls --collect-all SimpleITK --distpath build/backend --workpath build/pyinstaller --specpath build backend/run_backend.py
    if ($LASTEXITCODE -ne 0) { throw 'Backend packaging failed' }
} finally { Pop-Location }
