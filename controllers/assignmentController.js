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

  /**
   * Get current assignments across all courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCurrentAssignments: async (req, res) => {
    try {
      const startTime = Date.now();
      const timings = {
        courses: { start: 0, end: 0, duration: 0 },
        assignments: { start: 0, end: 0, duration: 0, byCourseDuration: {} },
        processing: { start: 0, end: 0, duration: 0 }
      };

      // Get all active courses
      timings.courses.start = Date.now();
      const courses = await canvasService.getCourses();
      timings.courses.end = Date.now();
      timings.courses.duration = timings.courses.end - timings.courses.start;

      // Get current date and calculate date range for filtering
      const now = new Date();
      const pastCutoff = new Date(now);
      pastCutoff.setDate(pastCutoff.getDate() - 7);
      const futureCutoff = new Date(now);
      futureCutoff.setDate(futureCutoff.getDate() + 30); // Get assignments due in next 30 days

      // Format dates for Canvas API
      const pastCutoffStr = pastCutoff.toISOString();
      const futureCutoffStr = futureCutoff.toISOString();

      // Array to store all current assignments
      let currentAssignments = [];

      // Process each course to get assignments with optimized API parameters
      timings.assignments.start = Date.now();

      // Use Promise.all to fetch assignments for all courses in parallel
      const assignmentPromises = courses.map(async (course) => {
        try {
          const courseStartTime = Date.now();

          // Get assignments for this course with optimized parameters
          const assignments = await canvasService.getCourseAssignments(course.id, {
            includeSubmission: true,
            dueAfter: pastCutoffStr,
            dueBefore: futureCutoffStr,
            orderBy: 'due_at',
            perPage: 50
          });

          // Add course information to each assignment
          const assignmentsWithCourseInfo = assignments.map(assignment => ({
            ...assignment,
            course_name: course.name,
            course_code: course.course_code,
            course_id: course.id
          }));

          const courseEndTime = Date.now();
          timings.assignments.byCourseDuration[course.id] = {
            courseName: course.name,
            duration: courseEndTime - courseStartTime,
            assignmentCount: assignments.length
          };

          return assignmentsWithCourseInfo;
        } catch (error) {
          console.error(`Error fetching assignments for course ${course.id}:`, error.message);
          timings.assignments.byCourseDuration[course.id] = {
            courseName: course.name,
            error: error.message
          };
          return [];
        }
      });

      // Wait for all promises to resolve
      const assignmentResults = await Promise.all(assignmentPromises);
      timings.assignments.end = Date.now();
      timings.assignments.duration = timings.assignments.end - timings.assignments.start;

      // Process and sort the results
      timings.processing.start = Date.now();

      // Flatten the array of arrays
      currentAssignments = assignmentResults.flat();

      // Sort by due date (ascending)
      currentAssignments.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at) - new Date(b.due_at);
      });

      timings.processing.end = Date.now();
      timings.processing.duration = timings.processing.end - timings.processing.start;

      // Calculate timing information
      const endTime = Date.now();
      const totalTimeMs = endTime - startTime;

      // Return the assignments with detailed timing information
      res.json({
        assignments: currentAssignments,
        count: currentAssignments.length,
        timing: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          totalTimeMs: totalTimeMs,
          totalTimeSec: (totalTimeMs / 1000).toFixed(2),
          totalTimeFormatted: formatTime(totalTimeMs),
          breakdown: {
            fetchCourses: {
              durationMs: timings.courses.duration,
              durationSec: (timings.courses.duration / 1000).toFixed(2),
              percentage: ((timings.courses.duration / totalTimeMs) * 100).toFixed(1) + '%'
            },
            fetchAssignments: {
              durationMs: timings.assignments.duration,
              durationSec: (timings.assignments.duration / 1000).toFixed(2),
              percentage: ((timings.assignments.duration / totalTimeMs) * 100).toFixed(1) + '%',
              byCourseDuration: timings.assignments.byCourseDuration
            },
            processing: {
              durationMs: timings.processing.duration,
              durationSec: (timings.processing.duration / 1000).toFixed(2),
              percentage: ((timings.processing.duration / totalTimeMs) * 100).toFixed(1) + '%'
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching current assignments:', error.message);
      res.status(500).json({ error: 'Failed to fetch current assignments', details: error.message });
    }
  }
};

module.exports = assignmentController;
