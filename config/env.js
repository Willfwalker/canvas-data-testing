const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Environment variables
const env = {
  PORT: process.env.PORT || 3000,
  CANVAS_URL: process.env.CANVAS_URL,
  CANVAS_API_KEY: process.env.CANVAS_API_KEY
};

// Validate required environment variables
if (!env.CANVAS_URL || !env.CANVAS_API_KEY) {
  console.error('Error: Canvas URL and API key must be provided in .env file');
  process.exit(1);
}

module.exports = env;
