# PowerShell script to create .env file for local development

Write-Host "🔧 Creating .env file..." -ForegroundColor Cyan

# Check if .env already exists
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "❌ Cancelled. .env file not modified." -ForegroundColor Red
        exit
    }
}

# Get MySQL password
Write-Host ""
Write-Host "📝 Enter your MySQL configuration:" -ForegroundColor Cyan
Write-Host ""

$dbHost = Read-Host "Database Host (default: localhost)"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

$dbUser = Read-Host "Database User (default: root)"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "root" }

$dbPassword = Read-Host "Database Password (press Enter if no password)" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

$dbName = Read-Host "Database Name (default: internet_billing_db)"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "internet_billing_db" }

# Generate JWT secret
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 40 | ForEach-Object {[char]$_})

# Create .env content
$envContent = @"
# Database Configuration
DB_HOST=$dbHost
DB_USER=$dbUser
DB_PASSWORD=$dbPasswordPlain
DB_NAME=$dbName

# JWT Configuration (Auto-generated - Change this for production!)
JWT_SECRET=$jwtSecret
JWT_EXPIRE=7d

# Server Configuration
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
"@

# Write to file
$envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline

Write-Host ""
Write-Host "✅ .env file created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "   Host: $dbHost"
Write-Host "   User: $dbUser"
Write-Host "   Database: $dbName"
Write-Host "   Password: $(if ([string]::IsNullOrWhiteSpace($dbPasswordPlain)) { 'Empty' } else { '***SET***' })"
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Verify MySQL is running"
Write-Host "   2. Create database if needed: CREATE DATABASE $dbName;"
Write-Host "   3. Start server: npm start"
Write-Host ""

