const canvasService = require('../services/canvasService');
const formatTime = require('../utils/formatTime');
const env = require('../config/env');

/**
 * Controller for assignment grades
 */
const assignmentGradesController = {
  /**
   * Get assignments with grades for Spring 2025 courses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getAssignmentGrades: async (req, res) => {
    try {
      const startTime = Date.now();
      const timings = {
        courses: { start: 0, end: 0, duration: 0 },
        assignments: { start: 0, end: 0, duration: 0 },
        processing: { start: 0, end: 0, duration: 0 }
      };

      // Get Spring 2025 courses directly from environment variables
      timings.courses.start = Date.now();
      const courses = await canvasService.getSpring2025Courses();
      timings.courses.end = Date.now();
      timings.courses.duration = timings.courses.end - timings.courses.start;

      // If no courses found, return empty result
      if (!courses || courses.length === 0) {
        const endTime = Date.now();
        return res.json({
          courses: [],
          assignments: {
            past: [],
            current: []
          },
          timing: {
            totalTimeMs: endTime - startTime,
            totalTimeSec: ((endTime - startTime) / 1000).toFixed(2),
            sections: timings
          },
          error: 'No Spring 2025 courses found'
        });
      }

      // Process each course to get assignments with grades
      timings.assignments.start = Date.now();

      // Use Promise.all to fetch data for all courses in parallel
      const courseDataPromises = courses.map(async (course) => {
        try {
          const courseStartTime = Date.now();
          const courseId = course.id;

          // Get assignments for this course with submissions included
          const assignments = await canvasService.getCourseAssignments(courseId, {
            includeSubmission: true,
            orderBy: 'due_at',
            perPage: 100
          });

          // Get submissions for this course to get detailed grade information
          const submissions = await canvasService.getCourseSubmissions(courseId);

          // Process assignments with submission data
          const processedAssignments = assignments.map(assignment => {
            // Find the submission for this assignment
            const submission = submissions.find(sub => sub.assignment_id === assignment.id);
            
            // Extract grade information
            const gradeInfo = submission ? {
              score: submission.score,
              grade: submission.grade,
              submitted_at: submission.submitted_at,
              late: submission.late,
              missing: submission.missing,
              graded: submission.workflow_state === 'graded',
              points_possible: assignment.points_possible,
              percentage: submission.score !== null && assignment.points_possible ? 
                (submission.score / assignment.points_possible * 100).toFixed(1) : null
            } : {
              score: null,
              grade: null,
              submitted_at: null,
              late: false,
              missing: true,
              graded: false,
              points_possible: assignment.points_possible,
              percentage: null
            };

            // Add course information to each assignment
            return {
              ...assignment,
              course_name: course.name,
              course_code: course.course_code,
              course_id: course.id,
              grade_info: gradeInfo
            };
          });

          // Return course data with processed assignments
          return {
            course_id: course.id,
            course_name: course.name,
            course_code: course.course_code,
            term: course.term ? course.term.name : 'Spring 2025',
            assignments: processedAssignments,
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
            term: course.term ? course.term.name : 'Spring 2025',
            assignments: [],
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

      // Get current date for filtering
      const now = new Date();

      // Filter assignments into past and current/upcoming
      const pastAssignments = allAssignments.filter(assignment => {
        if (!assignment.due_at) return false;
        return new Date(assignment.due_at) < now;
      });

      const currentAssignments = allAssignments.filter(assignment => {
        if (!assignment.due_at) return true; // Assignments without due dates go to current
        return new Date(assignment.due_at) >= now;
      });

      // Sort assignments by due date
      pastAssignments.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(b.due_at) - new Date(a.due_at); // Most recent first for past assignments
      });

      currentAssignments.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at) - new Date(b.due_at); // Earliest first for current assignments
      });

      timings.processing.end = Date.now();
      timings.processing.duration = timings.processing.end - timings.processing.start;

      // Calculate timing information
      const endTime = Date.now();
      const totalTimeMs = endTime - startTime;

      // Return the formatted response
      res.json({
        courses: courseData,
        assignments: {
          past: pastAssignments,
          current: currentAssignments
        },
        timing: {
          totalTimeMs,
          totalTimeSec: (totalTimeMs / 1000).toFixed(2),
          formattedTime: formatTime(totalTimeMs),
          sections: timings
        }
      });
    } catch (error) {
      console.error('Error fetching assignment grades:', error.message);
      res.status(500).json({ error: 'Failed to fetch assignment grades' });
    }
  }
};

module.exports = assignmentGradesController;
