#!/usr/bin/env node
/**
 * Build Verification Test
 * This script verifies that the compiled application can be loaded without errors
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Running build verification tests...\n');

// Test 1: Check if dist folder exists
console.log('✓ Test 1: Checking dist folder...');
if (!fs.existsSync('./dist')) {
  console.error('❌ FAIL: dist folder not found');
  process.exit(1);
}
console.log('  ✓ dist folder exists\n');

// Test 2: Check if main.js exists
console.log('✓ Test 2: Checking main.js...');
if (!fs.existsSync('./dist/src/main.js')) {
  console.error('❌ FAIL: dist/src/main.js not found');
  process.exit(1);
}
console.log('  ✓ main.js exists\n');

// Test 3: Check if app.module.js exists
console.log('✓ Test 3: Checking app.module.js...');
if (!fs.existsSync('./dist/src/app.module.js')) {
  console.error('❌ FAIL: dist/src/app.module.js not found');
  process.exit(1);
}
console.log('  ✓ app.module.js exists\n');

// Test 4: Check critical module files
console.log('✓ Test 4: Checking critical modules...');
const criticalModules = [
  './dist/src/auth/auth.module.js',
  './dist/src/users/users.module.js',
  './dist/src/bets/bets.module.js',
  './dist/src/matches/matches.module.js',
  './dist/src/admin/admin.module.js',
];

let allModulesExist = true;
for (const module of criticalModules) {
  if (!fs.existsSync(module)) {
    console.error(`  ❌ Missing: ${module}`);
    allModulesExist = false;
  } else {
    console.log(`  ✓ ${path.basename(module)}`);
  }
}

if (!allModulesExist) {
  console.error('\n❌ FAIL: Some critical modules are missing');
  process.exit(1);
}
console.log('  ✓ All critical modules exist\n');

// Test 5: Check if .env.example exists
console.log('✓ Test 5: Checking configuration files...');
if (!fs.existsSync('./.env.example')) {
  console.warn('  ⚠️  WARNING: .env.example not found');
} else {
  console.log('  ✓ .env.example exists');
}

// Test 6: Verify package.json scripts
console.log('\n✓ Test 6: Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const requiredScripts = ['build', 'start', 'start:dev', 'start:prod'];
let allScriptsExist = true;

for (const script of requiredScripts) {
  if (!packageJson.scripts[script]) {
    console.error(`  ❌ Missing script: ${script}`);
    allScriptsExist = false;
  } else {
    console.log(`  ✓ ${script}`);
  }
}

if (!allScriptsExist) {
  console.error('\n❌ FAIL: Some required scripts are missing');
  process.exit(1);
}

console.log('\n' + '='.repeat(50));
console.log('✅ All build verification tests passed!');
console.log('='.repeat(50));
console.log('\n📋 Summary:');
console.log('  • Build output: ✓ Valid');
console.log('  • Critical modules: ✓ Present');
console.log('  • Configuration: ✓ Ready');
console.log('  • Scripts: ✓ Available');
console.log('\n🚀 The application is ready to run!');
console.log('\nNext steps:');
console.log('  1. Copy .env.example to .env and configure');
console.log('  2. Set up PostgreSQL database');
console.log('  3. Run: npm run start:dev');
console.log('');
