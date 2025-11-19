# Check Supabase Project Status
# This helps diagnose connection issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Supabase Connection Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$envPath = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "[ERROR] .env file not found!" -ForegroundColor Red
    exit 1
}

$dbHost = (Get-Content $envPath | Select-String "DB_HOST=").ToString() -replace "DB_HOST=", ""

Write-Host "1. Testing DNS Resolution..." -ForegroundColor Yellow
try {
    $dnsResult = Resolve-DnsName -Name $dbHost -ErrorAction Stop
    Write-Host "   [OK] Hostname resolves to: $($dnsResult[0].IPAddress)" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Cannot resolve hostname" -ForegroundColor Red
    Write-Host "   This means Supabase project is PAUSED or deleted" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Solution:" -ForegroundColor Cyan
    Write-Host "   1. Go to https://supabase.com/dashboard" -ForegroundColor White
    Write-Host "   2. Check if project shows 'Paused' → Click 'Restore'" -ForegroundColor White
    Write-Host "   3. Wait 2-3 minutes for project to fully resume" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "2. Testing TCP Connection..." -ForegroundColor Yellow
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connect = $tcpClient.BeginConnect($dbHost, 5432, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(3000, $false)
    if ($wait) {
        $tcpClient.EndConnect($connect)
        Write-Host "   [OK] Port 5432 is accessible" -ForegroundColor Green
        $tcpClient.Close()
    } else {
        Write-Host "   [WARNING] Connection timeout (project might still be resuming)" -ForegroundColor Yellow
        $tcpClient.Close()
    }
} catch {
    Write-Host "   [ERROR] Cannot connect to port 5432" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   This could mean:" -ForegroundColor Yellow
    Write-Host "   - Project is still resuming (wait 2-3 minutes)" -ForegroundColor White
    Write-Host "   - Firewall blocking connection" -ForegroundColor White
    Write-Host "   - Wrong port (try 6543 for connection pooling)" -ForegroundColor White
}

Write-Host ""
Write-Host "3. Testing with Node.js..." -ForegroundColor Yellow
node test-supabase-connection.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[SUCCESS] Connection works!" -ForegroundColor Green
    Write-Host "You can now start the server: npm start" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "[ERROR] Node.js cannot connect" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible solutions:" -ForegroundColor Yellow
    Write-Host "1. Supabase project is paused → Resume it" -ForegroundColor White
    Write-Host "2. Wait 2-3 minutes after resuming" -ForegroundColor White
    Write-Host "3. Get fresh connection string from Supabase Dashboard" -ForegroundColor White
    Write-Host "4. Update .env with: npm run setup-supabase" -ForegroundColor White
    Write-Host "5. Try connection pooling port 6543 instead of 5432" -ForegroundColor White
}

