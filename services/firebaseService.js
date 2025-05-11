const { db, auth } = require('../config/firebase');

/**
 * Service for Firebase operations
 */
const firebaseService = {
  /**
   * Store Canvas credentials for a user
   * @param {string} uid - User ID
   * @param {Object} credentials - Canvas credentials
   * @returns {Promise<Object>} Result of operation
   */
  storeCanvasCredentials: async (uid, credentials) => {
    try {
      const { canvasUrl, canvasApiKey } = credentials;
      
      if (!canvasUrl || !canvasApiKey) {
        throw new Error('Canvas URL and API key are required');
      }
      
      // Store credentials in Firestore
      await db.collection('users').doc(uid).set({
        canvasCredentials: {
          url: canvasUrl,
          apiKey: canvasApiKey,
          updatedAt: new Date()
        }
      }, { merge: true });
      
      return { success: true };
    } catch (error) {
      console.error('Error storing Canvas credentials:', error);
      throw error;
    }
  },
  
  /**
   * Get Canvas credentials for a user
   * @param {string} uid - User ID
   * @returns {Promise<Object>} Canvas credentials
   */
  getCanvasCredentials: async (uid) => {
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      
      if (!userData.canvasCredentials) {
        throw new Error('Canvas credentials not found');
      }
      
      return {
        canvasUrl: userData.canvasCredentials.url,
        canvasApiKey: userData.canvasCredentials.apiKey
      };
    } catch (error) {
      console.error('Error getting Canvas credentials:', error);
      throw error;
    }
  },
  
  /**
   * Store user's courses in Firestore
   * @param {string} uid - User ID
   * @param {Array} courses - List of courses
   * @returns {Promise<Object>} Result of operation
   */
  storeCourses: async (uid, courses) => {
    try {
      // Get current date for labeling current/past courses
      const now = new Date();
      
      // Process courses to add status (current/past)
      const processedCourses = courses.map(course => {
        // Determine if course is current based on end_at date
        const endDate = course.end_at ? new Date(course.end_at) : null;
        const isCurrent = endDate ? endDate > now : true;
        
        return {
          id: course.id,
          name: course.name,
          course_code: course.course_code,
          term: course.term ? course.term.name : null,
          start_at: course.start_at,
          end_at: course.end_at,
          status: isCurrent ? 'current' : 'past',
          updatedAt: new Date()
        };
      });
      
      // Store courses in Firestore
      const batch = db.batch();
      
      // Create courses collection for user
      const userCoursesRef = db.collection('users').doc(uid).collection('courses');
      
      // Add each course to batch
      for (const course of processedCourses) {
        const courseRef = userCoursesRef.doc(course.id.toString());
        batch.set(courseRef, course);
      }
      
      // Commit batch
      await batch.commit();
      
      return { success: true, courseCount: processedCourses.length };
    } catch (error) {
      console.error('Error storing courses:', error);
      throw error;
    }
  },
  
  /**
   * Get user's courses from Firestore
   * @param {string} uid - User ID
   * @param {Object} options - Options for filtering courses
   * @returns {Promise<Array>} List of courses
   */
  getCourses: async (uid, options = {}) => {
    try {
      const { status } = options;
      
      let query = db.collection('users').doc(uid).collection('courses');
      
      // Filter by status if provided
      if (status) {
        query = query.where('status', '==', status);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return [];
      }
      
      // Convert snapshot to array of courses
      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error getting courses:', error);
      throw error;
    }
  },
  
  /**
   * Update course status (current/past) for all user's courses
   * @param {string} uid - User ID
   * @returns {Promise<Object>} Result of operation
   */
  updateCourseStatus: async (uid) => {
    try {
      // Get current date
      const now = new Date();
      
      // Get all user's courses
      const coursesSnapshot = await db.collection('users').doc(uid).collection('courses').get();
      
      if (coursesSnapshot.empty) {
        return { success: true, updated: 0 };
      }
      
      // Create batch for updates
      const batch = db.batch();
      let updatedCount = 0;
      
      // Update each course status
      coursesSnapshot.docs.forEach(doc => {
        const course = doc.data();
        const endDate = course.end_at ? new Date(course.end_at) : null;
        const isCurrent = endDate ? endDate > now : true;
        const newStatus = isCurrent ? 'current' : 'past';
        
        // Only update if status has changed
        if (course.status !== newStatus) {
          batch.update(doc.ref, { 
            status: newStatus,
            updatedAt: new Date()
          });
          updatedCount++;
        }
      });
      
      // Commit batch if there are updates
      if (updatedCount > 0) {
        await batch.commit();
      }
      
      return { success: true, updated: updatedCount };
    } catch (error) {
      console.error('Error updating course status:', error);
      throw error;
    }
  }
};

module.exports = firebaseService;
