# Start the FastAPI backend on http://127.0.0.1.nip.io:8000
# Usage:  ./run.ps1   (from the backend folder)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "./venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv venv
    ./venv/Scripts/python.exe -m pip install --upgrade pip
    ./venv/Scripts/python.exe -m pip install -r requirements.txt
}

# Seed sample portfolios on first run (idempotent).
if (-not (Test-Path "./blogger.db")) {
    Write-Host "Seeding sample portfolios..."
    ./venv/Scripts/python.exe seed.py
}

Write-Host "Backend running at http://127.0.0.1.nip.io:8000  (docs: /docs)"
./venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
