# Start backend server on port 8000
# This script ensures .env is correct and starts the server

Write-Host "Starting Backend Server on Port 8000..." -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    Write-Host "Run: .\fix-env-supabase.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Verify DB_PASSWORD is set
$envContent = Get-Content .env -Raw
if ($envContent -notmatch "DB_PASSWORD=.*[^\s]") {
    Write-Host "[ERROR] DB_PASSWORD not set in .env!" -ForegroundColor Red
    Write-Host "Run: .\fix-env-supabase.ps1 to fix it" -ForegroundColor Yellow
    exit 1
}

# Kill any existing process on port 8000
Write-Host "Checking port 8000..." -ForegroundColor Yellow
npm run kill-port | Out-Null
Start-Sleep -Seconds 1

# Start server
Write-Host "Starting server..." -ForegroundColor Green
Write-Host "Server will run on: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Health: http://localhost:8000/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

node server.js
