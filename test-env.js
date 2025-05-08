require('dotenv').config();
console.log('Testing environment variables:');
console.log('CANVAS_URL:', process.env.CANVAS_URL);
console.log('CANVAS_API_KEY:', process.env.CANVAS_API_KEY ? '[REDACTED]' : 'Not set');
