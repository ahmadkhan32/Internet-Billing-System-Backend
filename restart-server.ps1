# Restart server with Supabase connection
# This script kills the port and starts the server fresh

Write-Host "Restarting server for Supabase connection..." -ForegroundColor Cyan
Write-Host ""

# Kill port 8000
Write-Host "Killing process on port 8000..." -ForegroundColor Yellow
npm run kill-port
Start-Sleep -Seconds 2

# Verify .env file
Write-Host "Verifying .env file..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found! Run: .\fix-env-supabase.ps1" -ForegroundColor Red
    exit 1
}

$dbPassword = (Get-Content .env | Select-String "DB_PASSWORD=").ToString()
if ($dbPassword -notmatch "DB_PASSWORD=.*[^=]") {
    Write-Host "[ERROR] DB_PASSWORD not set in .env file!" -ForegroundColor Red
    Write-Host "Run: .\fix-env-supabase.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] .env file verified" -ForegroundColor Green
Write-Host ""

# Start server
Write-Host "Starting server..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

npm start

