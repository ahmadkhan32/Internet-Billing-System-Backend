#!/usr/bin/env node

/**
 * Show Environment Values Script
 * 
 * This script shows you the values you need to copy to Vercel.
 * It reads from your local .env file.
 * 
 * Usage: node show-env-values.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

console.log('📋 Environment Variables to Copy to Vercel\n');
console.log('─'.repeat(60));
console.log('');

const variables = [
  { key: 'NODE_ENV', value: 'production', required: true },
  { key: 'DB_HOST', value: process.env.DB_HOST, required: true },
  { key: 'DB_USER', value: process.env.DB_USER, required: true },
  { key: 'DB_PASSWORD', value: process.env.DB_PASSWORD, required: true, hide: true },
  { key: 'DB_NAME', value: process.env.DB_NAME, required: true },
  { key: 'JWT_SECRET', value: process.env.JWT_SECRET || 'my-super-secret-jwt-key-2024-production-xyz123456789', required: true, hide: true }
];

let allPresent = true;

console.log('Copy these values to Vercel → Settings → Environment Variables:\n');

variables.forEach(({ key, value, required, hide }) => {
  const isSet = value !== undefined && value !== '';
  const displayValue = hide ? '*** (hidden - use actual value)' : (value || 'NOT SET');
  
  if (required && !isSet) {
    allPresent = false;
  }
  
  console.log(`${key}=${displayValue}`);
  
  if (required && !isSet) {
    console.log(`   ⚠️  MISSING - You need to set this!`);
  }
});

console.log('');
console.log('─'.repeat(60));
console.log('');

if (!allPresent) {
  console.log('❌ Some required variables are missing from your .env file!');
  console.log('');
  console.log('💡 Options:');
  console.log('   1. Add missing variables to backend/.env file');
  console.log('   2. Get values from your database provider dashboard');
  console.log('   3. Then copy them to Vercel');
  console.log('');
} else {
  console.log('✅ All variables found in .env file!');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Copy the values above');
  console.log('   2. Go to Vercel → Settings → Environment Variables');
  console.log('   3. Add each variable (one by one)');
  console.log('   4. Set for Production environment');
  console.log('   5. Redeploy');
  console.log('');
}

console.log('⚠️  Important:');
console.log('   - DB_PASSWORD must be non-empty in Vercel');
console.log('   - Set all variables for Production environment');
console.log('   - Redeploy after adding variables');
console.log('   - Variables stay in Vercel permanently (set once, use forever)');
console.log('');

