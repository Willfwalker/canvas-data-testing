const express = require('express');
const courseController = require('../controllers/courseController');

const router = express.Router();

// Get all available courses
router.get('/courses', courseController.getCourses);

// Get calendar events
router.get('/calendar_events', courseController.getCalendarEvents);

module.exports = router;
