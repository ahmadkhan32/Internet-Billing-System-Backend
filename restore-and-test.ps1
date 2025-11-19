# Restore Supabase and Test Connection
# This script guides you through restoring Supabase and testing the connection

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restore Supabase & Test Connection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "STEP 1: Restore Supabase Project" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Click your project" -ForegroundColor White
Write-Host "3. Check status:" -ForegroundColor White
Write-Host "   - If 'Paused' -> Click 'Restore'" -ForegroundColor Gray
Write-Host "   - If 'Active' -> Click 'Pause' -> Wait 30s -> Click 'Restore'" -ForegroundColor Gray
Write-Host "4. Wait 3-5 minutes for database to start" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Have you restored the Supabase project? (y/n)"

if ($continue -ne "y" -and $continue -ne "Y") {
    Write-Host ""
    Write-Host "Please restore the Supabase project first!" -ForegroundColor Yellow
    Write-Host "Then run this script again." -ForegroundColor Yellow
    Write-Host ""
    exit
}

Write-Host ""
Write-Host "STEP 2: Testing Database Connection..." -ForegroundColor Yellow
Write-Host ""

# Change to backend directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = $scriptPath

if (-not (Test-Path (Join-Path $backendPath ".env"))) {
    Write-Host "ERROR: .env file not found in backend directory!" -ForegroundColor Red
    Write-Host "Please create .env file first." -ForegroundColor Yellow
    exit 1
}

# Test connection
Set-Location $backendPath
node check-db.js

$exitCode = $LASTEXITCODE

Write-Host ""

if ($exitCode -eq 0) {
    Write-Host "SUCCESS! Database connection is working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your project is ready to use!" -ForegroundColor Green
} else {
    Write-Host "Connection failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure Supabase project is restored and shows 'Active'" -ForegroundColor White
    Write-Host "2. Wait 2-3 more minutes (database might still be starting)" -ForegroundColor White
    Write-Host "3. Check .env file has correct credentials" -ForegroundColor White
    Write-Host "4. Try again: node check-db.js" -ForegroundColor White
    Write-Host ""
}

Write-Host ""

