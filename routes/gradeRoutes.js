const express = require('express');
const gradeController = require('../controllers/gradeController');

const router = express.Router();

// Get user grades across all courses (detailed version)
router.get('/grades', gradeController.getGrades);

// Get current term grades only (fast endpoint)
router.get('/current-term-grades', gradeController.getCurrentTermGrades);

// Get current grades for all courses (fast endpoint)
router.get('/current-grades', gradeController.getCurrentGrades);

module.exports = router;
