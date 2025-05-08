const express = require('express');
const springCoursesController = require('../controllers/springCoursesController');

const router = express.Router();

// Get assignments and grades for Spring 2025 courses
router.get('/spring-2025-courses', springCoursesController.getSpring2025CourseData);

module.exports = router;
