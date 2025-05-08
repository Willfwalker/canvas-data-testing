const express = require('express');
const assignmentController = require('../controllers/assignmentController');

const router = express.Router();

// Get minimal current assignments data (fast endpoint)
router.get('/minimal-assignments', assignmentController.getMinimalCurrentAssignments);

// Get assignments for a course
router.get('/courses/:courseId/assignments', assignmentController.getCourseAssignments);

// Get submissions for an assignment
router.get('/courses/:courseId/assignments/:assignmentId/submissions', assignmentController.getAssignmentSubmissions);

// Get current assignments across all courses
router.get('/current-assignments', assignmentController.getCurrentAssignments);

module.exports = router;
