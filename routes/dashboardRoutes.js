const express = require('express');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// Get combined course data, grades, and assignments in a single request
router.get('/combined-course-data', dashboardController.getCombinedCourseData);

// Get dashboard data (current assignments, announcements, user info, and courses)
router.get('/dashboard', dashboardController.getDashboardData);

// Get all data for a user
router.get('/all-data', dashboardController.getAllData);

module.exports = router;
