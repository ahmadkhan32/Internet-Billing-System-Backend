# Create .env file for localhost development
# This script creates a .env file with Supabase credentials

$envContent = @"
# Internet Billing System - Local Development Environment
# This file is for localhost development

# ============================================
# Server Configuration
# ============================================
NODE_ENV=development
PORT=8000
VERCEL=0

# ============================================
# Database Configuration
# ============================================
# Using Supabase (PostgreSQL) for localhost
DB_DIALECT=postgres

# Supabase Database Credentials
DB_HOST=db.qppdkzzmijjyoihzfdxw.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=3oqj6vL2Tr5BZLaf
DB_NAME=postgres
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# ============================================
# JWT Configuration
# ============================================
JWT_SECRET=2dc998eb35cb110e2f5d8a076e9f40875cbd2fc403db53b8d593eb1460b1b3be
JWT_EXPIRE=7d

# ============================================
# Frontend URL (Localhost)
# ============================================
FRONTEND_URL=http://localhost:3001

# ============================================
# Email Configuration (Optional)
# ============================================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# ============================================
# Payment Gateway (Optional)
# ============================================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
"@

$envPath = Join-Path $PSScriptRoot ".env"

if (Test-Path $envPath) {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/n)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "❌ Cancelled. .env file not modified." -ForegroundColor Red
        exit 0
    }
}

try {
    $envContent | Out-File -FilePath $envPath -Encoding utf8 -NoNewline
    Write-Host "✅ .env file created successfully!" -ForegroundColor Green
    Write-Host "📁 Location: $envPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ Configuration:" -ForegroundColor Green
    Write-Host "   - Database: Supabase (PostgreSQL)" -ForegroundColor White
    Write-Host "   - Backend Port: 8000" -ForegroundColor White
    Write-Host "   - Frontend URL: http://localhost:3001" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 You can now start the server with: npm start" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error creating .env file: $_" -ForegroundColor Red
    exit 1
}

