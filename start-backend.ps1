# Backend Startup Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Internet Billing System - Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if MySQL is running
Write-Host "Checking MySQL service..." -ForegroundColor Yellow
$mysqlServices = Get-Service | Where-Object {$_.DisplayName -like "*mysql*" -or $_.Name -like "*mysql*"}

if ($mysqlServices) {
    $mysql = $mysqlServices | Select-Object -First 1
    Write-Host "Found MySQL service: $($mysql.Name)" -ForegroundColor Green
    
    if ($mysql.Status -ne 'Running') {
        Write-Host "MySQL is not running. Attempting to start..." -ForegroundColor Yellow
        try {
            Start-Service -Name $mysql.Name -ErrorAction Stop
            Start-Sleep -Seconds 3
            Write-Host "MySQL started successfully!" -ForegroundColor Green
        } catch {
            Write-Host "Failed to start MySQL. Please start it manually:" -ForegroundColor Red
            Write-Host "  net start $($mysql.Name)" -ForegroundColor Yellow
            Write-Host "  OR use Services (services.msc)" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "MySQL is already running!" -ForegroundColor Green
    }
} else {
    Write-Host "WARNING: MySQL service not found!" -ForegroundColor Red
    Write-Host "Please ensure MySQL is installed and running." -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}

Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Start the server
npm start

