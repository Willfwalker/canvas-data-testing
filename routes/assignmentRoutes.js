const express = require('express');
const assignmentController = require('../controllers/assignmentController');

const router = express.Router();

// Get assignments for a course
router.get('/courses/:courseId/assignments', assignmentController.getCourseAssignments);

// Get submissions for an assignment
router.get('/courses/:courseId/assignments/:assignmentId/submissions', assignmentController.getAssignmentSubmissions);

module.exports = router;
