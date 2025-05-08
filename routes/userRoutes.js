const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// Get current user info
router.get('/user', userController.getCurrentUser);

// Get user's todo items
router.get('/todo', userController.getTodoItems);

module.exports = router;
