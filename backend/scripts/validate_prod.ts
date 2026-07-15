import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function logError(msg: string) {
  console.error(`\x1b[31m[VALIDATE:PROD ERROR] ${msg}\x1b[0m`);
}

function logSuccess(msg: string) {
  console.log(`\x1b[32m[VALIDATE:PROD SUCCESS] ${msg}\x1b[0m`);
}

function runValidation() {
  let hasFailed = false;

  console.log('Running Production Readiness Validation for Flowza...');

  // 1. Check for required Environment Variables
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_PRO_MONTHLY',
    'STRIPE_PRICE_BUSINESS_MONTHLY',
    'STRIPE_PRICE_PREMIUM_MONTHLY',
    'TURNSTILE_SECRET_KEY',
  ];

  // We check if either FIREBASE_SERVICE_ACCOUNT OR the individual cert keys are present
  const hasFirebaseSA = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  const hasFirebaseCertKeys = !!(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID);

  if (!hasFirebaseSA && !hasFirebaseCertKeys) {
    logError('Missing FIREBASE_SERVICE_ACCOUNT or (FIREBASE_PRIVATE_KEY & FIREBASE_CLIENT_EMAIL & FIREBASE_PROJECT_ID) in environment variables.');
    hasFailed = true;
  }

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar] || process.env[envVar]!.trim() === '') {
      logError(`Missing required environment variable: ${envVar}`);
      hasFailed = true;
    }
  }

  // 2. Check for Turnstile Site Key (which is a VITE_ env var for the frontend)
  const turnstileSiteKey = process.env.VITE_TURNSTILE_SITE_KEY;
  if (!turnstileSiteKey || turnstileSiteKey.trim() === '') {
    logError('Missing VITE_TURNSTILE_SITE_KEY (required for Cloudflare Turnstile bot protection on the frontend).');
    hasFailed = true;
  }

  // 3. Scan process.env for client-prefixed secrets (VITE_ prefix on non-public sensitive details)
  const forbiddenViteKeys = [
    'VITE_STRIPE_SECRET_KEY',
    'VITE_STRIPE_WEBHOOK_SECRET',
    'VITE_FIREBASE_PRIVATE_KEY',
    'VITE_FIREBASE_SERVICE_ACCOUNT',
    'VITE_TURNSTILE_SECRET_KEY',
    'VITE_GEMINI_API_KEY',
  ];

  for (const key of Object.keys(process.env)) {
    if (key.startsWith('VITE_')) {
      const lowerKey = key.toLowerCase();
      const value = process.env[key] || '';
      if (
        forbiddenViteKeys.includes(key) ||
        lowerKey.includes('secret') ||
        lowerKey.includes('private') ||
        lowerKey.includes('key_secret') ||
        (value.includes('sk_live') || value.includes('sk_test'))
      ) {
        logError(`Security risk: Found secret key prefixed with VITE_ in environment: ${key}`);
        hasFailed = true;
      }
    }
  }

  // Also read any .env files to check for client-prefixed secrets or missing configurations
  const envFiles = ['.env', '.env.local', '.env.production'];
  for (const file of envFiles) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#') || !line.includes('=')) continue;
        const [key, valRaw] = line.split('=');
        const val = (valRaw || '').trim();
        
        if (key.startsWith('VITE_')) {
          const lowerKey = key.toLowerCase();
          if (
            forbiddenViteKeys.includes(key) ||
            lowerKey.includes('secret') ||
            lowerKey.includes('private') ||
            val.startsWith('sk_live') ||
            val.startsWith('sk_test') ||
            (val.includes('-----BEGIN PRIVATE KEY-----') || val.includes('BEGIN PRIVATE KEY'))
          ) {
            logError(`Security risk in file ${file} at line ${i + 1}: Found secret key prefixed with VITE_: ${key}`);
            hasFailed = true;
          }
        }
      }
    }
  }

  // 4. Scan codebase for active dev/mock/placeholders in critical production files
  const filesToScan = [
    { name: 'server.ts', path: path.join(rootDir, 'server.ts') },
    { name: 'BookingPage.tsx', path: path.join(rootDir, 'src/pages/BookingPage.tsx') },
  ];

  // We check if code is explicitly referencing mock values as active fallback configurations
  for (const fileInfo of filesToScan) {
    if (fs.existsSync(fileInfo.path)) {
      const content = fs.readFileSync(fileInfo.path, 'utf-8');
      
      // Look for dev_mock_token usages outside of isTestToken declarations
      if (content.includes('"dev_mock_token"') && fileInfo.name !== 'server.ts') {
        logError(`Mock token found in codebase file ${fileInfo.name}: "dev_mock_token" is used.`);
        hasFailed = true;
      }

      // Check for price fallback placeholders when env is not checked
      if (content.includes('priceToPlan[\'price_pro_monthly\'] = \'PRO\'') && !content.includes('process.env.NODE_ENV !== \'production\'')) {
        logError(`Hardcoded pricing fallback check without NODE_ENV protection in ${fileInfo.name}.`);
        hasFailed = true;
      }
    }
  }

  if (hasFailed) {
    console.error('\n\x1b[31m⛔ Flowza production validation FAILED. Fix the listed security and configuration issues before deploying.\x1b[0m\n');
    process.exit(1);
  } else {
    logSuccess('All production readiness checks passed successfully!');
    process.exit(0);
  }
}

runValidation();
