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
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    try {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      // Ensure the key has the correct PEM headers if missing
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
      }
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        })
      });
    } catch (e) {
      console.error("Invalid Firebase credentials from environment", e);
      if (process.env.NODE_ENV === 'production') {
        throw new Error("Failed to initialize Firebase Admin SDK in production due to invalid credentials.");
      } else {
        admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
      }
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (e) {
      console.error("Invalid FIREBASE_SERVICE_ACCOUNT format", e);
      if (process.env.NODE_ENV === 'production') {
        throw new Error("Failed to initialize Firebase Admin SDK in production due to invalid service account.");
      } else {
        admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
      }
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: Missing Firebase environment variables. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are required in production.");
    }
    admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
  }
}

export const adminDb = databaseId ? getFirestore(admin.app(), databaseId) : getFirestore(admin.app());
export const adminAuth = admin.auth();
