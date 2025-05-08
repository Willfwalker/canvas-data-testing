const canvasService = require('../services/canvasService');
const formatTime = require('../utils/formatTime');

/**
 * Controller for Spring 2025 courses
 */
const springCoursesController = {
  /**
   * Get assignments and grades for Spring 2025 courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getSpring2025CourseData: async (req, res) => {
    try {
      const startTime = Date.now();
      const timings = {
        courses: { start: 0, end: 0, duration: 0 },
        assignments: { start: 0, end: 0, duration: 0 },
        processing: { start: 0, end: 0, duration: 0 }
      };

      // Get Spring 2025 courses with all necessary parameters
      timings.courses.start = Date.now();
      const courses = await canvasService.getSpring2025Courses({
        includeTerms: true,
        includeTeachers: true,
        includeTotalScores: true
      });
      timings.courses.end = Date.now();
      timings.courses.duration = timings.courses.end - timings.courses.start;

      // If no courses found, return empty result
      if (!courses || courses.length === 0) {
        const endTime = Date.now();
        return res.json({
          courses: [],
          assignments: [],
          timing: {
            totalTimeMs: endTime - startTime,
            totalTimeSec: ((endTime - startTime) / 1000).toFixed(2),
            sections: timings
          },
          error: 'No Spring 2025 courses found'
        });
      }

      // Get current date and calculate date range for filtering assignments
      const now = new Date();
      const pastCutoff = new Date(now);
      pastCutoff.setDate(pastCutoff.getDate() - 7);
      const futureCutoff = new Date(now);
      futureCutoff.setDate(futureCutoff.getDate() + 60); // Get assignments due in next 60 days

      // Format dates for Canvas API
      const pastCutoffStr = pastCutoff.toISOString();
      const futureCutoffStr = futureCutoff.toISOString();

      // Process each course to get assignments and grades
      timings.assignments.start = Date.now();

      // Use Promise.all to fetch data for all courses in parallel
      const courseDataPromises = courses.map(async (course) => {
        try {
          const courseStartTime = Date.now();
          const courseId = course.id;

          // Extract grade information from the course
          const enrollment = course.enrollments ?
            course.enrollments.find(e => e.type === 'student') : null;

          // Use current score if available, otherwise use final score
          const hasGrade = enrollment &&
                          (enrollment.computed_current_score !== undefined ||
                           enrollment.computed_final_score !== undefined);

          const grade = hasGrade ?
            (enrollment.computed_current_score !== undefined ?
              enrollment.computed_current_score :
              enrollment.computed_final_score) : null;

          const gradeLetter = hasGrade ?
            (enrollment.computed_current_grade !== undefined ?
              enrollment.computed_current_grade :
              enrollment.computed_final_grade) : null;

          // Get assignments for this course with optimized parameters
          const assignments = await canvasService.getCourseAssignments(courseId, {
            includeSubmission: true,
            dueAfter: pastCutoffStr,
            dueBefore: futureCutoffStr,
            orderBy: 'due_at',
            perPage: 100
          });

          // Add course information to each assignment
          const assignmentsWithCourseInfo = assignments.map(assignment => ({
            ...assignment,
            course_name: course.name,
            course_code: course.course_code,
            course_id: course.id
          }));

          // Return course data with assignments and grade
          return {
            course_id: course.id,
            course_name: course.name,
            course_code: course.course_code,
            term: course.term ? course.term.name : null,
            grade: grade,
            grade_letter: gradeLetter,
            assignments: assignmentsWithCourseInfo,
            timing: {
              courseTimeMs: Date.now() - courseStartTime
            }
          };
        } catch (error) {
          console.error(`Error processing course ${course.id}:`, error.message);
          return {
            course_id: course.id,
            course_name: course.name,
            course_code: course.course_code,
            term: course.term ? course.term.name : null,
            error: error.message
          };
        }
      });

      // Wait for all promises to resolve
      const courseData = await Promise.all(courseDataPromises);
      timings.assignments.end = Date.now();
      timings.assignments.duration = timings.assignments.end - timings.assignments.start;

      // Process and format the results
      timings.processing.start = Date.now();

      // Extract all assignments from course data
      const allAssignments = [];
      courseData.forEach(course => {
        if (course.assignments) {
          allAssignments.push(...course.assignments);
        }
      });

      // Sort assignments by due date (ascending)
      allAssignments.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at) - new Date(b.due_at);
      });

      timings.processing.end = Date.now();
      timings.processing.duration = timings.processing.end - timings.processing.start;

      // Calculate timing information
      const endTime = Date.now();
      const totalTimeMs = endTime - startTime;

      // Return the formatted response
      res.json({
        courses: courseData,
        assignments: allAssignments,
        timing: {
          totalTimeMs,
          totalTimeSec: (totalTimeMs / 1000).toFixed(2),
          formattedTime: formatTime(totalTimeMs),
          sections: timings
        }
      });
    } catch (error) {
      console.error('Error fetching Spring 2025 course data:', error.message);
      res.status(500).json({ error: 'Failed to fetch Spring 2025 course data' });
    }
  }
};

module.exports = springCoursesController;
