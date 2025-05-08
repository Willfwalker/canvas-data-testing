const canvasService = require('../services/canvasService');

/**
 * Course controller for handling course-related routes
 */
const courseController = {
  /**
   * Get all available courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCourses: async (req, res) => {
    try {
      const courses = await canvasService.getCourses();
      res.json(courses);
    } catch (error) {
      console.error('Error fetching courses:', error.message);
      res.status(500).json({ error: 'Failed to fetch courses' });
    }
  },

  /**
   * Get calendar events
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCalendarEvents: async (req, res) => {
    try {
      const events = await canvasService.getCalendarEvents();
      res.json(events);
    } catch (error) {
      console.error('Error fetching calendar events:', error.message);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  }
};

module.exports = courseController;
