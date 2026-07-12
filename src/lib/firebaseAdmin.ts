import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o config do Firebase
const configPath = path.resolve(__dirname, '../../firebase-applet-config.json');
let projectId = 'gen-lang-client-0509735842'; // default fallback
let databaseId = ''; 
try {
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (firebaseConfig.projectId) projectId = firebaseConfig.projectId;
    if (firebaseConfig.firestoreDatabaseId) databaseId = firebaseConfig.firestoreDatabaseId;
  }
} catch (e) {
  console.warn("Could not read firebase config");
}

if (!admin.apps.length) {
  let initialized = false;

  // 1. Try FIREBASE_SERVICE_ACCOUNT first, as it contains complete, verified credentials
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin SDK successfully initialized via FIREBASE_SERVICE_ACCOUNT.");
      initialized = true;
    } catch (e) {
      console.error("Failed to initialize Firebase Admin via FIREBASE_SERVICE_ACCOUNT:", e);
    }
  }

  // 2. If not initialized yet, try individual environment variables
  if (!initialized && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    try {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
      
      // Remove surrounding literal quotes if any
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1);
      }

      // Replace literal escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      privateKey = privateKey.replace(/\\r/g, '');

      // Ensure correct PEM formatting by cleaning and restructuring the base64 payload
      const header = '-----BEGIN PRIVATE KEY-----';
      const footer = '-----END PRIVATE KEY-----';
      
      if (!privateKey.includes(header)) {
        const rawContent = privateKey.replace(/\s+/g, '');
        const match = rawContent.match(/.{1,64}/g);
        const base64Lines = match ? match.join('\n') : rawContent;
        privateKey = `${header}\n${base64Lines}\n${footer}`;
      } else {
        const startIdx = privateKey.indexOf(header);
        const endIdx = privateKey.indexOf(footer);
        if (startIdx !== -1 && endIdx !== -1) {
          const rawContent = privateKey.substring(startIdx + header.length, endIdx).replace(/\s+/g, '');
          const match = rawContent.match(/.{1,64}/g);
          const base64Lines = match ? match.join('\n') : rawContent;
          privateKey = `${header}\n${base64Lines}\n${footer}`;
        }
      }
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        })
      });
      console.log("Firebase Admin SDK successfully initialized via individual FIREBASE_PRIVATE_KEY.");
      initialized = true;
    } catch (e) {
      console.error("Invalid individual Firebase credentials from environment", e);
    }
  }

  // 3. Fallback to Application Default Credentials (ADC) if allowed or in non-production
  if (!initialized) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: Missing or invalid Firebase environment credentials in production. Both FIREBASE_SERVICE_ACCOUNT and individual variables failed to initialize.");
    } else {
      console.log("Falling back to Firebase Admin SDK applicationDefault credentials.");
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId
      });
    }
  }
}

export const adminDb = databaseId ? getFirestore(admin.app(), databaseId) : getFirestore(admin.app());
export const adminAuth = admin.auth();
