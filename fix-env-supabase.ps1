# Fix .env file for Supabase connection
# This script ensures all Supabase variables are set correctly

$envPath = Join-Path $PSScriptRoot ".env"

Write-Host "🔧 Fixing .env file for Supabase connection..." -ForegroundColor Cyan
Write-Host ""

# Create clean .env file with Supabase credentials
$envContent = @"
NODE_ENV=development
PORT=8000
VERCEL=0

DB_DIALECT=postgres
DB_HOST=db.qppdkzzmijjyoihzfdxw.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=3oqj6vL2Tr5BZLaf
DB_NAME=postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

JWT_SECRET=2dc998eb35cb110e2f5d8a076e9f40875cbd2fc403db53b8d593eb1460b1b3be
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:3001
"@

try {
    $envContent | Out-File -FilePath $envPath -Encoding utf8 -NoNewline
    Write-Host "[OK] .env file updated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Configuration:" -ForegroundColor Cyan
    Write-Host "   DB_DIALECT: postgres" -ForegroundColor White
    Write-Host "   DB_HOST: db.qppdkzzmijjyoihzfdxw.supabase.co" -ForegroundColor White
    Write-Host "   DB_USER: postgres" -ForegroundColor White
    Write-Host "   DB_PASSWORD: SET" -ForegroundColor White
    Write-Host "   DB_NAME: postgres" -ForegroundColor White
    Write-Host ""
    Write-Host "[OK] Ready to connect to Supabase!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error updating .env file: $_" -ForegroundColor Red
    exit 1
}

