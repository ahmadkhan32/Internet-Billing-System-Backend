#!/usr/bin/env node

/**
 * Check Environment Variables Script
 * 
 * This script helps you verify your environment variables
 * before setting them in Vercel.
 * 
 * Usage: node check-env.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('🔍 Checking Environment Variables...\n');

const requiredVars = {
  'NODE_ENV': 'production',
  'DB_HOST': 'your-database-host',
  'DB_USER': 'your-database-username',
  'DB_PASSWORD': 'your-database-password (MUST be non-empty)',
  'DB_NAME': 'your-database-name',
  'JWT_SECRET': 'your-32-character-secret-key'
};

const results = [];
let allPresent = true;

console.log('📋 Environment Variables Status:\n');

for (const [varName, description] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  const isSet = value !== undefined && value !== '';
  const isNonEmpty = value !== undefined && value.trim() !== '';
  
  let status = '❌ MISSING';
  let displayValue = 'NOT SET';
  
  if (isSet) {
    if (varName === 'DB_PASSWORD' || varName === 'JWT_SECRET') {
      displayValue = '***SET*** (hidden)';
      status = isNonEmpty ? '✅ SET' : '⚠️  SET BUT EMPTY';
    } else {
      displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
      status = '✅ SET';
    }
  }
  
  if (!isSet || (varName === 'DB_PASSWORD' && !isNonEmpty)) {
    allPresent = false;
  }
  
  console.log(`${status} ${varName}`);
  console.log(`   Description: ${description}`);
  console.log(`   Value: ${displayValue}`);
  console.log('');
  
  results.push({
    name: varName,
    status: status,
    isSet: isSet,
    isNonEmpty: isNonEmpty
  });
}

console.log('─'.repeat(60));
console.log('');

if (allPresent) {
  console.log('✅ All required environment variables are set!');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('1. Copy these values to Vercel → Settings → Environment Variables');
  console.log('2. Make sure to set them for Production environment');
  console.log('3. Redeploy your project in Vercel');
  console.log('');
} else {
  console.log('❌ Some environment variables are missing or empty!');
  console.log('');
  console.log('📋 Missing Variables:');
  results.forEach(r => {
    if (!r.isSet || (r.name === 'DB_PASSWORD' && !r.isNonEmpty)) {
      console.log(`   - ${r.name}`);
    }
  });
  console.log('');
  console.log('💡 How to Fix:');
  console.log('1. Add missing variables to backend/.env file');
  console.log('2. Or get values from your database provider dashboard');
  console.log('3. Then add them to Vercel → Settings → Environment Variables');
  console.log('4. Redeploy in Vercel');
  console.log('');
  console.log('📖 See setup-vercel-env.md for detailed instructions');
  console.log('');
  process.exit(1);
}

// Show values for Vercel (except passwords)
console.log('─'.repeat(60));
console.log('📋 Values to Copy to Vercel:');
console.log('');
results.forEach(r => {
  if (r.name === 'DB_PASSWORD' || r.name === 'JWT_SECRET') {
    console.log(`${r.name}=*** (hidden - use actual value from .env)`);
  } else {
    const value = process.env[r.name];
    console.log(`${r.name}=${value || 'NOT SET'}`);
  }
});
console.log('');
console.log('⚠️  Remember:');
console.log('   - DB_PASSWORD must be non-empty in Vercel');
console.log('   - Set all variables for Production environment');
console.log('   - Redeploy after adding variables');
console.log('');

