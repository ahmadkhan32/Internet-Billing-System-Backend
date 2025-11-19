# Fix ENOTFOUND Error - Complete Solution
# Run this script to fix the database connection issue

Write-Host ""
Write-Host "🔧 Fixing ENOTFOUND Database Connection Error" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
$envPath = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envPath)) {
    Write-Host "❌ .env file is MISSING!" -ForegroundColor Red
    Write-Host ""
    Write-Host "This is why your connection fails every time!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Creating .env file from template..." -ForegroundColor Cyan
    
    # Read template
    $templatePath = Join-Path $PSScriptRoot "env.template"
    
    if (Test-Path $templatePath) {
        # Copy template to .env
        Copy-Item $templatePath $envPath
        Write-Host "✅ Created .env file from template" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  IMPORTANT: Update DB_PASSWORD with your actual Supabase password!" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "❌ Template file not found!" -ForegroundColor Red
        Write-Host "Creating .env file with default values..." -ForegroundColor Cyan
        
        # Create .env with default values
        $envContent = @"
NODE_ENV=development
PORT=8000
VERCEL=0

DB_DIALECT=postgres
DB_HOST=db.qppdkzzmijjyoihzfdxw.supabase.co
DB_PORT=6543
DB_USER=postgres
DB_PASSWORD=3oqj6vL2Tr5BZLaf
DB_NAME=postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

JWT_SECRET=2dc998eb35cb110e2f5d8a076e9f40875cbd2fc403db53b8d593eb1460b1b3be
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:3001
"@
        
        $envContent | Out-File -FilePath $envPath -Encoding utf8
        Write-Host "✅ Created .env file" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  IMPORTANT: Update DB_PASSWORD with your actual Supabase password!" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
    Write-Host ""
}

# Check Supabase project status
Write-Host "📋 Next Steps to Fix ENOTFOUND Error:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. RESTORE SUPABASE PROJECT (CRITICAL):" -ForegroundColor Yellow
Write-Host "   - Go to: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "   - Click your project" -ForegroundColor White
Write-Host "   - If 'Paused' → Click 'Restore'" -ForegroundColor White
Write-Host "   - If 'Active' → Click 'Pause' → Wait 30s → Click 'Restore'" -ForegroundColor White
Write-Host "   - Wait 3-5 minutes for database to start" -ForegroundColor White
Write-Host ""
Write-Host "2. GET FRESH CREDENTIALS:" -ForegroundColor Yellow
Write-Host "   - Supabase Dashboard → Settings → Database" -ForegroundColor White
Write-Host "   - Connection string → URI tab" -ForegroundColor White
Write-Host "   - Copy the full connection string" -ForegroundColor White
Write-Host ""
Write-Host "3. UPDATE .env FILE:" -ForegroundColor Yellow
Write-Host "   - Run: .\get-supabase-credentials.ps1" -ForegroundColor White
Write-Host "   - Paste connection string when prompted" -ForegroundColor White
Write-Host "   - OR manually update DB_PASSWORD in .env file" -ForegroundColor White
Write-Host ""
Write-Host "4. USE PORT 6543 (Connection Pooling):" -ForegroundColor Yellow
Write-Host "   - In .env file, set: DB_PORT=6543" -ForegroundColor White
Write-Host "   - This is more reliable than port 5432" -ForegroundColor White
Write-Host ""
Write-Host "5. TEST CONNECTION:" -ForegroundColor Yellow
Write-Host "   - Run: node check-db.js" -ForegroundColor White
Write-Host "   - Should see: ✅ Database connection is working!" -ForegroundColor White
Write-Host ""

# Check current .env values
if (Test-Path $envPath) {
    Write-Host "📋 Current .env Configuration:" -ForegroundColor Cyan
    Write-Host ""
    
    $envContent = Get-Content $envPath
    $dbHost = ($envContent | Select-String "DB_HOST=").ToString().Split("=")[1]
    $dbPort = ($envContent | Select-String "DB_PORT=").ToString().Split("=")[1]
    $dbUser = ($envContent | Select-String "DB_USER=").ToString().Split("=")[1]
    $dbName = ($envContent | Select-String "DB_NAME=").ToString().Split("=")[1]
    $dbPassword = ($envContent | Select-String "DB_PASSWORD=").ToString().Split("=")[1]
    
    Write-Host "  DB_HOST: $dbHost" -ForegroundColor White
    Write-Host "  DB_PORT: $dbPort" -ForegroundColor $(if ($dbPort -eq "6543") { "Green" } else { "Yellow" })
    Write-Host "  DB_USER: $dbUser" -ForegroundColor White
    Write-Host "  DB_NAME: $dbName" -ForegroundColor White
    Write-Host "  DB_PASSWORD: $($dbPassword.Length) characters" -ForegroundColor White
    Write-Host ""
    
    if ($dbPort -ne "6543") {
        Write-Host "⚠️  WARNING: Using port $dbPort instead of 6543" -ForegroundColor Yellow
        Write-Host "   Port 6543 (connection pooling) is more reliable!" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "💡 Why ENOTFOUND Error Happens:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Supabase project is PAUSED (most common)" -ForegroundColor White
Write-Host "     → Free tier auto-pauses after 1 week of inactivity" -ForegroundColor Gray
Write-Host "     → Paused projects = Hostname doesn't resolve" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Missing .env file (your current issue)" -ForegroundColor White
Write-Host "     → Environment variables not loaded" -ForegroundColor Gray
Write-Host "     → Connection fails immediately" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Wrong credentials or hostname" -ForegroundColor White
Write-Host "     → Project was deleted/recreated" -ForegroundColor Gray
Write-Host "     → Credentials changed" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Using wrong port" -ForegroundColor White
Write-Host "     → Port 5432 (direct) is less reliable" -ForegroundColor Gray
Write-Host "     → Port 6543 (pooling) is more reliable" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Script completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Restore Supabase project and test connection!" -ForegroundColor Cyan
Write-Host ""

