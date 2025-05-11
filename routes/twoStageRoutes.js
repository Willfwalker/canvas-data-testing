const express = require('express');
const twoStageController = require('../controllers/twoStageController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get data in two stages: first courses, then assignments
router.get('/two-stage-data', authMiddleware, twoStageController.getTwoStageData);

module.exports = router;
