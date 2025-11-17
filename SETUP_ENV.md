# Environment Setup Guide

## ⚠️ IMPORTANT: Create .env File

The `.env` file is missing! You need to create it before the server can start.

## Quick Setup Steps

### Step 1: Create .env File

1. Navigate to the `backend` folder
2. Create a new file named `.env` (with the dot at the beginning)
3. Copy the content below into the file

### Step 2: Configure Database Settings

Edit the `.env` file with your MySQL credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=internet_billing_db

# JWT Configuration (REQUIRED)
JWT_SECRET=your_random_secret_key_minimum_32_characters_long
JWT_EXPIRE=7d

# Server Configuration
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001
```

### Step 3: Important Settings

**DB_PASSWORD**: 
- If your MySQL root user has no password, leave it empty: `DB_PASSWORD=`
- If your MySQL root user has a password, enter it: `DB_PASSWORD=yourpassword`

**JWT_SECRET**: 
- **REQUIRED** - Generate a random string (minimum 32 characters)
- Example: `JWT_SECRET=my_super_secret_jwt_key_12345678901234567890`
- You can use: https://randomkeygen.com/ (use "CodeIgniter Encryption Keys")

**DB_NAME**: 
- Make sure the database exists in MySQL
- If not, create it: `CREATE DATABASE internet_billing_db;`

## Complete .env Template

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=internet_billing_db

# JWT Configuration (REQUIRED - Change this!)
JWT_SECRET=change_this_to_a_random_string_minimum_32_characters_long_for_security
JWT_EXPIRE=7d

# Server Configuration
PORT=8000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# SMS Configuration (Optional)
SMS_API_URL=https://your-sms-provider.com/api
SMS_API_KEY=your_sms_api_key

# Stripe Configuration (Optional)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

## Verify MySQL Setup

1. **Check if MySQL is running:**
   ```bash
   # Windows
   net start MySQL
   
   # Or check services
   services.msc
   ```

2. **Connect to MySQL:**
   ```bash
   mysql -u root -p
   ```

3. **Create database (if needed):**
   ```sql
   CREATE DATABASE IF NOT EXISTS internet_billing_db;
   SHOW DATABASES;
   EXIT;
   ```

4. **Test connection:**
   ```bash
   mysql -u root -p internet_billing_db
   ```
   If this works, your credentials are correct.

## After Creating .env

1. Save the `.env` file
2. Restart the backend server:
   ```bash
   npm start
   # or
   npm run dev
   ```

3. You should see:
   ```
   ✅ Database connection established successfully
   ✅ Database models synchronized
   🚀 Server running on port 8000
   ```

## Common Issues

**"Access denied for user"**
- Wrong password in `DB_PASSWORD`
- MySQL user doesn't exist
- MySQL not running

**"Unknown database"**
- Database doesn't exist
- Wrong `DB_NAME` in `.env`
- Create database: `CREATE DATABASE internet_billing_db;`

**"JWT_SECRET not configured"**
- `JWT_SECRET` is missing or empty
- Must be at least 32 characters

## Quick Fix for Empty Password

If your MySQL root has no password, use:
```env
DB_PASSWORD=
```
(Leave it empty, but keep the `=` sign)

