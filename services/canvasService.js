const { fetchAllPages } = require('../utils/canvasAPI');

/**
 * Service for Canvas API operations
 */
const canvasService = {
  /**
   * Get current user information
   * @param {Object} credentials - Canvas API credentials
   * @returns {Promise<Object>} User data
   */
  getUserInfo: async (credentials) => {
    return await fetchAllPages('/api/v1/users/self', {
      ...credentials
    });
  },

  /**
   * Get all available courses
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} List of courses
   */
  getCourses: async (options = {}) => {
    const {
      includeTerms = true,
      includeTeachers = true,
      includeTotalScores = true,
      canvasUrl,
      canvasApiKey
    } = options;

    let url = '/api/v1/courses?state[]=available';

    if (includeTerms) url += '&include[]=term';
    if (includeTeachers) url += '&include[]=teachers';
    if (includeTotalScores) url += '&include[]=total_scores';

    return await fetchAllPages(url, {
      canvasUrl,
      canvasApiKey
    });
  },

  /**
   * Get assignments for a specific course
   * @param {number} courseId - Course ID
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} List of assignments
   */
  getCourseAssignments: async (courseId, options = {}) => {
    const {
      includeSubmission = false,
      dueAfter = null,
      dueBefore = null,
      orderBy = 'due_at',
      perPage = 50,
      canvasUrl,
      canvasApiKey
    } = options;

    let url = `/api/v1/courses/${courseId}/assignments?per_page=${perPage}&order_by=${orderBy}`;

    if (includeSubmission) url += '&include[]=submission';
    if (dueAfter) url += `&due_after=${encodeURIComponent(dueAfter)}`;
    if (dueBefore) url += `&due_before=${encodeURIComponent(dueBefore)}`;

    return await fetchAllPages(url, {
      canvasUrl,
      canvasApiKey
    });
  },

  /**
   * Get submissions for a specific assignment
   * @param {number} courseId - Course ID
   * @param {number} assignmentId - Assignment ID
   * @param {Object} credentials - Canvas API credentials
   * @returns {Promise<Array>} List of submissions
   */
  getAssignmentSubmissions: async (courseId, assignmentId, credentials) => {
    return await fetchAllPages(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, {
      ...credentials
    });
  },

  /**
   * Get announcements for all available courses
   * @param {Array} courses - List of courses
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} List of announcements
   */
  getAnnouncements: async (courses, options = {}) => {
    const {
      latestOnly = false,
      startDate = '2023-01-01',
      canvasUrl,
      canvasApiKey
    } = options;

    // Build context codes for courses (format: course_123)
    const contextCodes = courses.map(course => `course_${course.id}`);

    // If no courses found, return empty array
    if (contextCodes.length === 0) {
      return [];
    }

    // Build the announcements URL with required parameters
    const announcementsUrl = '/api/v1/announcements?' +
      `context_codes[]=${contextCodes.join('&context_codes[]=')}` + // Add context codes for each course
      `&latest_only=${latestOnly}` + // Get all announcements or just the latest
      `&start_date=${startDate}`; // Get announcements from this date

    return await fetchAllPages(announcementsUrl, {
      canvasUrl,
      canvasApiKey
    });
  },

  /**
   * Get calendar events
   * @param {Object} credentials - Canvas API credentials
   * @returns {Promise<Array>} List of calendar events
   */
  getCalendarEvents: async (credentials) => {
    return await fetchAllPages('/api/v1/calendar_events', {
      ...credentials
    });
  },

  /**
   * Get user's todo items
   * @param {Object} credentials - Canvas API credentials
   * @returns {Promise<Array>} List of todo items
   */
  getTodoItems: async (credentials) => {
    return await fetchAllPages('/api/v1/users/self/todo', {
      ...credentials
    });
  },

  /**
   * Get student submissions for a course
   * @param {number} courseId - Course ID
   * @param {Object} credentials - Canvas API credentials
   * @returns {Promise<Array>} List of submissions
   */
  getCourseSubmissions: async (courseId, credentials) => {
    return await fetchAllPages(`/api/v1/courses/${courseId}/students/submissions?student_ids[]=self`, {
      silentErrors: true,
      ...credentials
    });
  },

  /**
   * Get current courses from Firestore
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} List of current courses
   */
  getCurrentCourses: async (options = {}) => {
    const {
      includeTerms = true,
      includeTeachers = true,
      includeTotalScores = true,
      uid,
      canvasUrl,
      canvasApiKey
    } = options;

    if (!uid) {
      throw new Error('User ID is required to get current courses');
    }

    // Get user's courses from Firestore
    const { db } = require('../config/firebase');
    const coursesSnapshot = await db.collection('users').doc(uid).collection('courses')
      .where('status', '==', 'current')
      .get();

    if (coursesSnapshot.empty) {
      console.warn('No current courses found for user in Firestore');
      return [];
    }

    // Get course IDs from Firestore
    const courseIds = coursesSnapshot.docs.map(doc => parseInt(doc.id));

    // Get all courses from Canvas
    const allCourses = await canvasService.getCourses({
      includeTerms,
      includeTeachers,
      includeTotalScores,
      canvasUrl,
      canvasApiKey
    });

    // Filter courses by IDs from Firestore
    return allCourses.filter(course => courseIds.includes(course.id));
  }
};

module.exports = canvasService;
