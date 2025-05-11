const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Environment variables
const env = {
  PORT: process.env.PORT || 3001,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT
};

// Validate required Firebase environment variables
if (!env.FIREBASE_PROJECT_ID) {
  console.warn('Warning: Firebase Project ID not provided in .env file');
}

module.exports = env;
