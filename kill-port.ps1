# PowerShell script to kill process on port 8000
# Usage: .\kill-port.ps1 [port]

param(
    [int]$Port = 8000
)

Write-Host "Checking for processes on port $Port..." -ForegroundColor Yellow

$processes = netstat -ano | findstr ":$Port"

if ($processes) {
    $pids = $processes | ForEach-Object {
        $parts = $_ -split '\s+'
        $parts[-1]
    } | Select-Object -Unique

    foreach ($processId in $pids) {
        if ($processId -and $processId -ne "0") {
            Write-Host "Killing process with PID: $processId" -ForegroundColor Red
            taskkill /PID $processId /F
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Process $processId terminated successfully" -ForegroundColor Green
            } else {
                Write-Host "Failed to kill process $processId" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "No processes found on port $Port" -ForegroundColor Green
}

Write-Host ""
Write-Host "You can now start the server" -ForegroundColor Cyan
