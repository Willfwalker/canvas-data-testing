const canvasService = require('../services/canvasService');
const formatTime = require('../utils/formatTime');

/**
 * Assignment controller for handling assignment-related routes
 */
const assignmentController = {

  /**
   * Get assignments for a course
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCourseAssignments: async (req, res) => {
    try {
      const { courseId } = req.params;
      const assignments = await canvasService.getCourseAssignments(courseId);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error.message);
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  },

  /**
   * Get submissions for an assignment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAssignmentSubmissions: async (req, res) => {
    try {
      const { courseId, assignmentId } = req.params;
      const submissions = await canvasService.getAssignmentSubmissions(courseId, assignmentId);
      res.json(submissions);
    } catch (error) {
      console.error('Error fetching submissions:', error.message);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  },


};

module.exports = assignmentController;
