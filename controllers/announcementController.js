const canvasService = require('../services/canvasService');

/**
 * Announcement controller for handling announcement-related routes
 */
const announcementController = {
  /**
   * Get announcements for all available courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAnnouncements: async (req, res) => {
    try {
      // First get all active courses to build context codes
      const courses = await canvasService.getCourses({ includeTerms: false, includeTeachers: false });
      
      // Get announcements using the service
      const announcements = await canvasService.getAnnouncements(courses, {
        latestOnly: false,
        startDate: '2023-01-01'
      });
      
      res.json(announcements);
    } catch (error) {
      console.error('Error fetching announcements:', error.message);
      res.status(500).json({ error: 'Failed to fetch announcements', details: error.message });
    }
  }
};

module.exports = announcementController;
