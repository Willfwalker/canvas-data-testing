const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
let firebaseApp;

try {
  // Check if Firebase Admin SDK is already initialized
  if (!admin.apps.length) {
    // Initialize with service account if provided
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    } else {
      // Initialize with application default credentials
      firebaseApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }
    
    console.log('Firebase Admin SDK initialized successfully');
  } else {
    firebaseApp = admin.app();
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

// Get Firestore instance
const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
