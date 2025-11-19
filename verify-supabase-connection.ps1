# Verify and Fix Supabase Connection
# This script helps you get the correct Supabase credentials

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Supabase Connection Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check current .env
$envPath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    Write-Host "Run: npm run setup-supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host "Current .env configuration:" -ForegroundColor Yellow
$dbHost = (Get-Content $envPath | Select-String "DB_HOST=").ToString() -replace "DB_HOST=", ""
$dbUser = (Get-Content $envPath | Select-String "DB_USER=").ToString() -replace "DB_USER=", ""
$dbPassword = (Get-Content $envPath | Select-String "DB_PASSWORD=").ToString() -replace "DB_PASSWORD=", ""
$dbName = (Get-Content $envPath | Select-String "DB_NAME=").ToString() -replace "DB_NAME=", ""
$vercel = (Get-Content $envPath | Select-String "VERCEL=").ToString() -replace "VERCEL=", ""

Write-Host "  DB_HOST: $dbHost" -ForegroundColor White
Write-Host "  DB_USER: $dbUser" -ForegroundColor White
Write-Host "  DB_PASSWORD: $($dbPassword.Length) characters" -ForegroundColor White
Write-Host "  DB_NAME: $dbName" -ForegroundColor White
Write-Host "  VERCEL: $vercel" -ForegroundColor White
Write-Host ""

# Test DNS resolution
Write-Host "Testing hostname resolution..." -ForegroundColor Yellow
try {
    $dnsResult = Resolve-DnsName -Name $dbHost -ErrorAction Stop
    Write-Host "[OK] Hostname resolves to: $($dnsResult[0].IPAddress)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Cannot resolve hostname: $dbHost" -ForegroundColor Red
    Write-Host ""
    Write-Host "This means:" -ForegroundColor Yellow
    Write-Host "  1. Supabase project is PAUSED (most likely)" -ForegroundColor White
    Write-Host "  2. Wrong hostname in .env file" -ForegroundColor White
    Write-Host "  3. Supabase project was deleted" -ForegroundColor White
    Write-Host ""
    Write-Host "Solution:" -ForegroundColor Cyan
    Write-Host "  1. Go to https://supabase.com" -ForegroundColor White
    Write-Host "  2. Check if project is paused → Click 'Restore'" -ForegroundColor White
    Write-Host "  3. Get fresh connection string from Settings → Database" -ForegroundColor White
    Write-Host "  4. Run: npm run setup-supabase" -ForegroundColor White
    exit 1
}

# Test connection
Write-Host ""
Write-Host "Testing database connection..." -ForegroundColor Yellow
node test-supabase-connection.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] Connection successful!" -ForegroundColor Green
    Write-Host "You can now start the server with: npm start" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "[ERROR] Connection failed!" -ForegroundColor Red
    Write-Host "See error message above for details." -ForegroundColor Yellow
}

