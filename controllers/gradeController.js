const canvasService = require('../services/canvasService');
const formatTime = require('../utils/formatTime');

/**
 * Grade controller for handling grade-related routes
 */
const gradeController = {
  /**
   * Get user grades across all courses (detailed version)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getGrades: async (req, res) => {
    try {
      // First get all courses
      const courses = await canvasService.getCourses();

      // Then get grades for each course
      const gradesPromises = courses.map(async (course) => {
        try {
          const submissions = await canvasService.getCourseSubmissions(course.id);
          return {
            course_id: course.id,
            course_name: course.name,
            course_code: course.course_code,
            term: course.term ? course.term.name : null,
            submissions: Array.isArray(submissions) ? submissions : []
          };
        } catch (error) {
          return {
            course_id: course.id,
            course_name: course.name,
            course_code: course.course_code,
            term: course.term ? course.term.name : null,
            submissions: [],
            error: error.message
          };
        }
      });

      const grades = await Promise.all(gradesPromises);
      res.json(grades);
    } catch (error) {
      console.error('Error fetching grades:', error.message);
      res.status(500).json({ error: 'Failed to fetch grades' });
    }
  },

  /**
   * Get current term grades only (fast endpoint)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCurrentTermGrades: async (req, res) => {
    try {
      const startTime = Date.now();
      const timings = {
        courses: { start: 0, end: 0, duration: 0 },
        processing: { start: 0, end: 0, duration: 0 }
      };

      // Get all active courses with the correct parameters for grades
      timings.courses.start = Date.now();

      // We need to include total_scores to get the grades and enrollment_term to filter by current term
      const courses = await canvasService.getCourses();

      timings.courses.end = Date.now();
      timings.courses.duration = timings.courses.end - timings.courses.start;

      // Process grades
      timings.processing.start = Date.now();

      // Get the current date to determine current term
      const now = new Date();
      const currentMonth = now.getMonth(); // 0-11

      // Determine current term based on month
      // Spring: January-May (0-4), Summer: June-July (5-6), Fall: August-December (7-11)
      let currentTermPattern;
      if (currentMonth >= 0 && currentMonth <= 4) {
        currentTermPattern = /spring|sp/i;
      } else if (currentMonth >= 5 && currentMonth <= 6) {
        currentTermPattern = /summer|su/i;
      } else {
        currentTermPattern = /fall|fa/i;
      }

      // Filter courses to only include those from the current term
      const currentTermCourses = courses.filter(course => {
        // Check if the course has a term
        if (!course.term) return false;

        // Check if the term name matches the current term pattern
        return currentTermPattern.test(course.term.name);
      });

      // Extract just the grade information from each course
      const gradesData = currentTermCourses.map(course => {
        // Find the student enrollment (if any)
        const enrollment = course.enrollments ?
          course.enrollments.find(e => e.type === 'student') : null;

        // Get the current score if available
        const hasGrade = enrollment &&
                        (enrollment.computed_current_score !== undefined ||
                         enrollment.computed_final_score !== undefined);

        // Use current score if available, otherwise use final score
        const grade = hasGrade ?
          (enrollment.computed_current_score !== undefined ?
            enrollment.computed_current_score :
            enrollment.computed_final_score) : null;

        const gradeLetter = hasGrade ?
          (enrollment.computed_current_grade !== undefined ?
            enrollment.computed_current_grade :
            enrollment.computed_final_grade) : null;

        return {
          course_id: course.id,
          course_name: course.name,
          course_code: course.course_code,
          grade: grade,
          grade_letter: gradeLetter,
          term: course.term ? course.term.name : null,
          enrollment_type: enrollment ? enrollment.type : null
        };
      });

      // Sort by course name
      gradesData.sort((a, b) => {
        if (a.course_name < b.course_name) return -1;
        if (a.course_name > b.course_name) return 1;
        return 0;
      });

      timings.processing.end = Date.now();
      timings.processing.duration = timings.processing.end - timings.processing.start;

      // Calculate total time
      const endTime = Date.now();
      const totalTimeMs = endTime - startTime;

      // Return the grades with timing information
      res.json({
        grades: gradesData,
        count: gradesData.length,
        current_term: currentTermPattern.toString().replace(/\//g, ''),
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
            processing: {
              durationMs: timings.processing.duration,
              durationSec: (timings.processing.duration / 1000).toFixed(2),
              percentage: ((timings.processing.duration / totalTimeMs) * 100).toFixed(1) + '%'
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching current term grades:', error.message);
      res.status(500).json({
        error: 'Failed to fetch current term grades',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  },

  /**
   * Get current grades for all courses (fast endpoint)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCurrentGrades: async (req, res) => {
    try {
      const startTime = Date.now();
      const timings = {
        courses: { start: 0, end: 0, duration: 0 },
        processing: { start: 0, end: 0, duration: 0 }
      };

      // Get all active courses with the correct parameters for grades
      timings.courses.start = Date.now();

      // We need to include total_scores to get the grades
      const courses = await canvasService.getCourses();

      timings.courses.end = Date.now();
      timings.courses.duration = timings.courses.end - timings.courses.start;

      // Process grades
      timings.processing.start = Date.now();

      // Extract just the grade information from each course
      const gradesData = courses
        .filter(course => course.enrollments && course.enrollments.length > 0)
        .map(course => {
          // Find the student enrollment (if any)
          const enrollment = course.enrollments ?
            course.enrollments.find(e => e.type === 'student') : null;

          // Get the current score if available
          const hasGrade = enrollment &&
                          (enrollment.computed_current_score !== undefined ||
                           enrollment.computed_final_score !== undefined);

          // Use current score if available, otherwise use final score
          const grade = hasGrade ?
            (enrollment.computed_current_score !== undefined ?
              enrollment.computed_current_score :
              enrollment.computed_final_score) : null;

          const gradeLetter = hasGrade ?
            (enrollment.computed_current_grade !== undefined ?
              enrollment.computed_current_grade :
              enrollment.computed_final_grade) : null;

          return {
            course_id: course.id,
            course_name: course.name,
            course_code: course.course_code,
            grade: grade,
            grade_letter: gradeLetter,
            term: course.term ? course.term.name : null,
            enrollment_type: enrollment ? enrollment.type : null
          };
        });

      // Sort by course name
      gradesData.sort((a, b) => {
        if (a.course_name < b.course_name) return -1;
        if (a.course_name > b.course_name) return 1;
        return 0;
      });

      timings.processing.end = Date.now();
      timings.processing.duration = timings.processing.end - timings.processing.start;

      // Calculate total time
      const endTime = Date.now();
      const totalTimeMs = endTime - startTime;

      // Return the grades with timing information
      res.json({
        grades: gradesData,
        count: gradesData.length,
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
            processing: {
              durationMs: timings.processing.duration,
              durationSec: (timings.processing.duration / 1000).toFixed(2),
              percentage: ((timings.processing.duration / totalTimeMs) * 100).toFixed(1) + '%'
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching current grades:', error.message);
      res.status(500).json({
        error: 'Failed to fetch current grades',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};

module.exports = gradeController;
