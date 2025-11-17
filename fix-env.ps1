# Fix .env file - Add missing DB_PASSWORD

Write-Host "🔧 Fixing .env file..." -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "💡 Run: .\create-env.ps1 to create it" -ForegroundColor Yellow
    exit
}

# Read current .env
$envContent = Get-Content ".env" -Raw

# Check if DB_PASSWORD exists
if ($envContent -notmatch "DB_PASSWORD") {
    Write-Host "⚠️  DB_PASSWORD is missing. Adding it..." -ForegroundColor Yellow
    
    # Get password from user
    Write-Host ""
    Write-Host "Enter your MySQL password (press Enter if no password):" -ForegroundColor Cyan
    $password = Read-Host -AsSecureString
    $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
    
    # Add DB_PASSWORD after DB_USER line
    if ($envContent -match "DB_USER=([^\r\n]+)") {
        $envContent = $envContent -replace "(DB_USER=[^\r\n]+)", "`$1`r`nDB_PASSWORD=$passwordPlain"
    } else {
        # If DB_USER not found, add both
        $envContent = "DB_HOST=localhost`r`nDB_USER=root`r`nDB_PASSWORD=$passwordPlain`r`nDB_NAME=internet_billing_db`r`n" + $envContent
    }
    
    # Save
    $envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
    Write-Host "✅ DB_PASSWORD added to .env file" -ForegroundColor Green
} else {
    Write-Host "✅ DB_PASSWORD already exists in .env file" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 If you're still getting errors, check:" -ForegroundColor Yellow
    Write-Host "   1. DB_PASSWORD value is correct"
    Write-Host "   2. MySQL is running: net start MySQL"
    Write-Host "   3. Database exists: CREATE DATABASE internet_billing_db;"
}

Write-Host ""
Write-Host "🚀 Try starting the server again: npm start" -ForegroundColor Cyan

