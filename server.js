const express = require('express');
const corsMiddleware = require('./middleware/cors');
const routes = require('./routes');
const authRoutes = require('./routes/authRoutes');
const env = require('./config/env');
const { db } = require('./config/firebase');

const app = express();
const PORT = env.PORT || 3001;

// Middleware
app.use(corsMiddleware);
app.use(express.json());

// API Routes
app.use('/api', routes);
app.use('/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Firebase connected: ${!!db}`);
});
