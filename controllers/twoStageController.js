const canvasService = require('../services/canvasService');
const formatTime = require('../utils/formatTime');

/**
 * Controller for two-stage data fetching
 */
const twoStageController = {
  /**
   * Get data in two stages:
   * 1. First fetch Spring 2025 courses
   * 2. Then fetch assignment details for those courses
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getTwoStageData: async (req, res) => {
    try {
      const startTime = Date.now();
      const timings = {
        stage1: {
          start: 0,
          end: 0,
          duration: 0,
          courses: { start: 0, end: 0, duration: 0 },
          announcements: { start: 0, end: 0, duration: 0 }
        },
        stage2: { start: 0, end: 0, duration: 0 },
        processing: { start: 0, end: 0, duration: 0 }
      };

      // Stage 1: Get Spring 2025 courses and announcements
      timings.stage1.start = Date.now();

      // Get courses
      timings.stage1.courses.start = Date.now();
      const courses = await canvasService.getSpring2025Courses({
        includeTerms: true,
        includeTeachers: true,
        includeTotalScores: true
      });
      timings.stage1.courses.end = Date.now();
      timings.stage1.courses.duration = timings.stage1.courses.end - timings.stage1.courses.start;

      // Get announcements
      timings.stage1.announcements.start = Date.now();
      let announcements = [];
      if (courses && courses.length > 0) {
        announcements = await canvasService.getAnnouncements(courses, {
          latestOnly: false,
          startDate: '2023-01-01'
        });

        // Sort announcements by posted date (newest first)
        announcements.sort((a, b) => {
          return new Date(b.posted_at) - new Date(a.posted_at);
        });
      }
      timings.stage1.announcements.end = Date.now();
      timings.stage1.announcements.duration = timings.stage1.announcements.end - timings.stage1.announcements.start;

      timings.stage1.end = Date.now();
      timings.stage1.duration = timings.stage1.end - timings.stage1.start;

      // If no courses found, return empty result
      if (!courses || courses.length === 0) {
        const endTime = Date.now();
        return res.json({
          stage: 'complete',
          courses: [],
          announcements: [],
          assignments: [],
          timing: {
            totalTimeMs: endTime - startTime,
            totalTimeSec: ((endTime - startTime) / 1000).toFixed(2),
            formattedTime: formatTime(endTime - startTime),
            sections: timings
          },
          error: 'No Spring 2025 courses found'
        });
      }

      // Process course data to include grade information
      const processedCourses = courses.map(course => {
        // Find enrollment with current grade
        const enrollment = course.enrollments && course.enrollments.find(
          e => e.type === 'student' && (e.computed_current_score || e.computed_final_score)
        );

        // Extract grade information
        const hasGrade = enrollment && (
          enrollment.computed_current_score !== undefined ||
          enrollment.computed_final_score !== undefined
        );

        const grade = hasGrade ?
          (enrollment.computed_current_score !== undefined ?
            enrollment.computed_current_score :
            enrollment.computed_final_score) : null;

        const gradeLetter = hasGrade ?
          (enrollment.computed_current_grade !== undefined ?
            enrollment.computed_current_grade :
            enrollment.computed_final_grade) : null;

        return {
          id: course.id,
          name: course.name,
          course_code: course.course_code,
          term: course.term ? course.term.name : null,
          grade: grade,
          grade_letter: gradeLetter,
          teachers: course.teachers || []
        };
      });

      // Stage 2: Get assignments for each course
      timings.stage2.start = Date.now();

      // Get current date and calculate date range for filtering assignments
      const now = new Date();
      const pastCutoff = new Date(now);
      pastCutoff.setDate(pastCutoff.getDate() - 7);
      const futureCutoff = new Date(now);
      futureCutoff.setDate(futureCutoff.getDate() + 60); // Get assignments due in next 60 days

      // Format dates for Canvas API
      const pastCutoffStr = pastCutoff.toISOString();
      const futureCutoffStr = futureCutoff.toISOString();

      // Process each course to get assignments
      const courseDataPromises = courses.map(async (course) => {
        try {
          const courseStartTime = Date.now();
          const courseId = course.id;

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

          return {
            course_id: course.id,
            course_name: course.name,
            course_code: course.course_code,
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
            error: error.message
          };
        }
      });

      // Wait for all promises to resolve
      const courseAssignmentData = await Promise.all(courseDataPromises);
      timings.stage2.end = Date.now();
      timings.stage2.duration = timings.stage2.end - timings.stage2.start;

      // Process and format the results
      timings.processing.start = Date.now();

      // Extract all assignments from course data
      const allAssignments = [];
      courseAssignmentData.forEach(course => {
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
        stage: 'complete',
        courses: processedCourses,
        announcements: announcements,
        courseAssignments: courseAssignmentData,
        assignments: allAssignments,
        timing: {
          totalTimeMs,
          totalTimeSec: (totalTimeMs / 1000).toFixed(2),
          formattedTime: formatTime(totalTimeMs),
          sections: timings
        }
      });
    } catch (error) {
      console.error('Error in two-stage data fetching:', error.message);
      res.status(500).json({ error: 'Failed to fetch two-stage data', details: error.message });
    }
  }
};

module.exports = twoStageController;
