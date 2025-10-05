// backend/config/firebase.js - Firebase Admin SDK Configuration
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;

// Try to load service account from file
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(path.resolve(serviceAccountPath));
  console.log('✅ Firebase service account loaded from file');
} else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  // Use individual environment variables
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  };
  console.log('✅ Firebase credentials loaded from environment variables');
} else {
  console.error('❌ ERROR: Firebase Admin credentials not found');
  console.error('Please provide either:');
  console.error('1. FIREBASE_SERVICE_ACCOUNT_PATH pointing to service account JSON file');
  console.error('2. Individual credentials: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });

  console.log('✅ Firebase Admin initialized successfully');
  console.log(`📌 Project ID: ${serviceAccount.projectId || serviceAccount.project_id}`);
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };