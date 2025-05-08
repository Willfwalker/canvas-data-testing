const canvasService = require('../services/canvasService');

/**
 * User controller for handling user-related routes
 */
const userController = {
  /**
   * Get current user info
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCurrentUser: async (req, res) => {
    try {
      const userData = await canvasService.getUserInfo();
      res.json(userData);
    } catch (error) {
      console.error('Error fetching user data:', error.message);
      res.status(500).json({ error: 'Failed to fetch user data' });
    }
  },

  /**
   * Get user's todo items
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getTodoItems: async (req, res) => {
    try {
      const todo = await canvasService.getTodoItems();
      res.json(todo);
    } catch (error) {
      console.error('Error fetching todo items:', error.message);
      res.status(500).json({ error: 'Failed to fetch todo items' });
    }
  }
};

module.exports = userController;
