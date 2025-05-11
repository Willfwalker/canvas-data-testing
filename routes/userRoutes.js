const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Protected routes (authentication required)
router.get('/user', authMiddleware, userController.getCurrentUser);
router.get('/todo', authMiddleware, userController.getTodoItems);

module.exports = router;
