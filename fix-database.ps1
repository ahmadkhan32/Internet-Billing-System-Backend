# Database Fix Script for Windows PowerShell
# Run this script to automatically fix database schema issues

Write-Host "🔧 Starting database fix process..." -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location $PSScriptRoot

# Run the fix script
node utils/fixDatabase.js

Write-Host ""
Write-Host "✅ Database fix completed!" -ForegroundColor Green
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

