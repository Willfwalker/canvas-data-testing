const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', authController.register);

// Protected routes (authentication required)
router.post('/canvas-credentials', authMiddleware, authController.storeCanvasCredentials);
router.get('/canvas-credentials', authMiddleware, authController.getCanvasCredentials);
router.get('/courses', authMiddleware, authController.getUserCourses);
router.post('/courses/refresh', authMiddleware, authController.refreshUserCourses);
router.post('/courses/update-status', authMiddleware, authController.updateCourseStatus);
router.post('/courses/ensure', authMiddleware, authController.ensureUserHasCourses);

module.exports = router;
