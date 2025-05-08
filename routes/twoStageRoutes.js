const express = require('express');
const twoStageController = require('../controllers/twoStageController');

const router = express.Router();

// Get data in two stages: first courses, then assignments
router.get('/two-stage-data', twoStageController.getTwoStageData);

module.exports = router;
