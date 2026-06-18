# Start the React (Vite) frontend on http://localhost:5173
# Usage:  ./run.ps1   (from the frontend folder)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "./node_modules")) {
    Write-Host "Installing npm dependencies..."
    npm install
}

Write-Host "Frontend running at http://localhost:5173"
npm run dev
