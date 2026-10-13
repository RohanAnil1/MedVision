#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
.venv/bin/python -m PyInstaller --noconfirm --onedir --name medvision-backend --paths backend --collect-all pydicom --collect-all pylibjpeg --collect-all libjpeg --collect-all openjpeg --collect-all pyjpegls --distpath build/backend --workpath build/pyinstaller --specpath build backend/run_backend.py
