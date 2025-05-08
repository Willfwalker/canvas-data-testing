const axios = require('axios');
const env = require('./env');

// Canvas API configuration
const canvasAPI = axios.create({
  baseURL: env.CANVAS_URL,
  headers: {
    'Authorization': `Bearer ${env.CANVAS_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

module.exports = canvasAPI;
