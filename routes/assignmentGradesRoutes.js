const express = require('express');
const assignmentGradesController = require('../controllers/assignmentGradesController');

const router = express.Router();

// Get assignments with grades for Spring 2025 courses
router.get('/assignment-grades', assignmentGradesController.getAssignmentGrades);

module.exports = router;
