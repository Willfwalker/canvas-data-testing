const { fetchAllPages } = require('../utils/canvasAPI');
const env = require('../config/env');

/**
 * Service for Canvas API operations
 */
const canvasService = {
  /**
   * Get current user information
   * @returns {Promise<Object>} User data
   */
  getUserInfo: async () => {
    return await fetchAllPages('/api/v1/users/self');
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
      includeTotalScores = true
    } = options;

    let url = '/api/v1/courses?state[]=available';

    if (includeTerms) url += '&include[]=term';
    if (includeTeachers) url += '&include[]=teachers';
    if (includeTotalScores) url += '&include[]=total_scores';

    return await fetchAllPages(url);
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
      perPage = 50
    } = options;

    let url = `/api/v1/courses/${courseId}/assignments?per_page=${perPage}&order_by=${orderBy}`;

    if (includeSubmission) url += '&include[]=submission';
    if (dueAfter) url += `&due_after=${encodeURIComponent(dueAfter)}`;
    if (dueBefore) url += `&due_before=${encodeURIComponent(dueBefore)}`;

    return await fetchAllPages(url);
  },

  /**
   * Get submissions for a specific assignment
   * @param {number} courseId - Course ID
   * @param {number} assignmentId - Assignment ID
   * @returns {Promise<Array>} List of submissions
   */
  getAssignmentSubmissions: async (courseId, assignmentId) => {
    return await fetchAllPages(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`);
  },

  /**
   * Get announcements for all available courses
   * @param {Array} courses - List of courses
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} List of announcements
   */
  getAnnouncements: async (courses, options = {}) => {
    const { latestOnly = false, startDate = '2023-01-01' } = options;

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

    return await fetchAllPages(announcementsUrl);
  },

  /**
   * Get calendar events
   * @returns {Promise<Array>} List of calendar events
   */
  getCalendarEvents: async () => {
    return await fetchAllPages('/api/v1/calendar_events');
  },

  /**
   * Get user's todo items
   * @returns {Promise<Array>} List of todo items
   */
  getTodoItems: async () => {
    return await fetchAllPages('/api/v1/users/self/todo');
  },

  /**
   * Get student submissions for a course
   * @param {number} courseId - Course ID
   * @returns {Promise<Array>} List of submissions
   */
  getCourseSubmissions: async (courseId) => {
    return await fetchAllPages(`/api/v1/courses/${courseId}/students/submissions?student_ids[]=self`, { silentErrors: true });
  },

  /**
   * Get Spring 2025 courses from environment variable
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} List of Spring 2025 courses
   */
  getSpring2025Courses: async (options = {}) => {
    const {
      includeTerms = true,
      includeTeachers = true,
      includeTotalScores = true
    } = options;

    // Get all courses first
    const allCourses = await canvasService.getCourses({
      includeTerms,
      includeTeachers,
      includeTotalScores
    });

    // Filter courses by IDs from environment variable
    const spring2025CourseIds = env.SPRING_2025_COURSE_IDS;

    if (!spring2025CourseIds || spring2025CourseIds.length === 0) {
      console.warn('No Spring 2025 course IDs found in environment variables');
      return [];
    }

    return allCourses.filter(course => spring2025CourseIds.includes(course.id));
  }
};

module.exports = canvasService;
