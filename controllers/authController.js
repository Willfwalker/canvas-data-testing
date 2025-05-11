const { auth } = require('../config/firebase');
const firebaseService = require('../services/firebaseService');
const canvasService = require('../services/canvasService');

/**
 * Authentication controller
 */
const authController = {
  /**
   * Register a new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  register: async (req, res) => {
    try {
      const { email, password, canvasUrl, canvasApiKey } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (!canvasUrl || !canvasApiKey) {
        return res.status(400).json({ error: 'Canvas URL and API key are required' });
      }

      // Create user in Firebase
      const userRecord = await auth.createUser({
        email,
        password,
        emailVerified: false
      });

      // Store Canvas credentials
      await firebaseService.storeCanvasCredentials(userRecord.uid, {
        canvasUrl,
        canvasApiKey
      });

      // Create custom token for frontend authentication
      const token = await auth.createCustomToken(userRecord.uid);

      // Fetch and store user's courses
      try {
        // Use the user's Canvas credentials
        const courses = await canvasService.getCourses({
          canvasUrl,
          canvasApiKey
        });

        // Store courses in Firestore
        await firebaseService.storeCourses(userRecord.uid, courses);

        res.status(201).json({
          message: 'User registered successfully',
          token,
          coursesImported: courses.length
        });
      } catch (courseError) {
        console.error('Error importing courses during registration:', courseError);

        // Still return success, but with error message about courses
        res.status(201).json({
          message: 'User registered successfully, but failed to import courses',
          token,
          courseError: courseError.message
        });
      }
    } catch (error) {
      console.error('Registration error:', error);

      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({ error: 'Email already in use' });
      }

      res.status(500).json({ error: 'Registration failed', details: error.message });
    }
  },

  /**
   * Store Canvas credentials for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  storeCanvasCredentials: async (req, res) => {
    try {
      const { canvasUrl, canvasApiKey } = req.body;
      const { uid } = req.user;

      if (!canvasUrl || !canvasApiKey) {
        return res.status(400).json({ error: 'Canvas URL and API key are required' });
      }

      // Store credentials
      await firebaseService.storeCanvasCredentials(uid, {
        canvasUrl,
        canvasApiKey
      });

      res.json({ message: 'Canvas credentials stored successfully' });
    } catch (error) {
      console.error('Error storing Canvas credentials:', error);
      res.status(500).json({ error: 'Failed to store Canvas credentials', details: error.message });
    }
  },

  /**
   * Get Canvas credentials for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCanvasCredentials: async (req, res) => {
    try {
      const { uid } = req.user;

      // Get credentials
      const credentials = await firebaseService.getCanvasCredentials(uid);

      res.json(credentials);
    } catch (error) {
      console.error('Error getting Canvas credentials:', error);
      res.status(500).json({ error: 'Failed to get Canvas credentials', details: error.message });
    }
  },

  /**
   * Get user's courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getUserCourses: async (req, res) => {
    try {
      const { uid } = req.user;
      const { status } = req.query;

      // Get courses from Firestore
      const courses = await firebaseService.getCourses(uid, { status });

      res.json(courses);
    } catch (error) {
      console.error('Error getting user courses:', error);
      res.status(500).json({ error: 'Failed to get user courses', details: error.message });
    }
  },

  /**
   * Refresh user's courses from Canvas
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  refreshUserCourses: async (req, res) => {
    try {
      const { uid } = req.user;

      // Get user's Canvas credentials
      const credentials = await firebaseService.getCanvasCredentials(uid);

      // Fetch courses from Canvas
      const courses = await canvasService.getCourses(credentials);

      // Store courses in Firestore
      const result = await firebaseService.storeCourses(uid, courses);

      res.json({
        message: 'Courses refreshed successfully',
        courseCount: result.courseCount
      });
    } catch (error) {
      console.error('Error refreshing user courses:', error);
      res.status(500).json({ error: 'Failed to refresh user courses', details: error.message });
    }
  },

  /**
   * Update course status for all user's courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  updateCourseStatus: async (req, res) => {
    try {
      const { uid } = req.user;

      // Update course status
      const result = await firebaseService.updateCourseStatus(uid);

      res.json({
        message: 'Course status updated successfully',
        updated: result.updated
      });
    } catch (error) {
      console.error('Error updating course status:', error);
      res.status(500).json({ error: 'Failed to update course status', details: error.message });
    }
  },

  /**
   * Ensure user has courses, fetching them if they don't exist
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  ensureUserHasCourses: async (req, res) => {
    try {
      const { uid } = req.user;

      // Check if user has courses
      const existingCourses = await firebaseService.getCourses(uid);

      if (existingCourses.length > 0) {
        return res.json({
          message: 'User already has courses',
          courseCount: existingCourses.length
        });
      }

      // User has no courses, fetch them from Canvas
      let credentials;
      try {
        credentials = await firebaseService.getCanvasCredentials(uid);
      } catch (credError) {
        console.log('Canvas credentials not found, returning empty response');
        // Return a 200 response with a user-friendly message
        return res.json({
          message: 'Canvas credentials not found',
          courseCount: 0,
          needsCredentials: true
        });
      }

      const courses = await canvasService.getCourses(credentials);

      // Store courses in Firestore
      const result = await firebaseService.storeCourses(uid, courses);

      res.json({
        message: 'Courses imported successfully',
        courseCount: result.courseCount
      });
    } catch (error) {
      console.error('Error ensuring user has courses:', error);
      // Return a 200 response with an error message instead of a 500 error
      res.json({
        message: 'Failed to ensure user has courses',
        error: error.message,
        courseCount: 0
      });
    }
  }
};

module.exports = authController;
