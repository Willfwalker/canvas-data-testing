const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Canvas API configuration
const CANVAS_URL = process.env.CANVAS_URL;
const CANVAS_API_KEY = process.env.CANVAS_API_KEY;

if (!CANVAS_URL || !CANVAS_API_KEY) {
  console.error('Error: Canvas URL and API key must be provided in .env file');
  process.exit(1);
}

// Helper function to format time in a human-readable format
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Canvas API helper functions
const canvasAPI = axios.create({
  baseURL: CANVAS_URL,
  headers: {
    'Authorization': `Bearer ${CANVAS_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Function to handle paginated API requests with optimized pagination
async function fetchAllPages(url, options = {}) {
  const { silentErrors = false, maxPages = 10, logTiming = false } = options;
  let allData = [];
  let nextUrl = url;
  let pageCount = 0;
  let startTime = Date.now();
  let timings = [];

  while (nextUrl && pageCount < maxPages) {
    const pageStartTime = Date.now();
    pageCount++;

    try {
      // Add a cache buster to avoid browser caching
      const separator = nextUrl.includes('?') ? '&' : '?';
      const urlWithCacheBuster = `${nextUrl}${separator}_=${Date.now()}`;

      const response = await canvasAPI.get(urlWithCacheBuster);
      const data = response.data;

      const pageEndTime = Date.now();
      const pageDuration = pageEndTime - pageStartTime;

      if (logTiming) {
        timings.push({
          page: pageCount,
          url: nextUrl,
          durationMs: pageDuration,
          dataSize: Array.isArray(data) ? data.length : 1
        });
      }

      if (Array.isArray(data)) {
        allData = [...allData, ...data];

        // If we got fewer items than the page size, we're probably at the end
        // This helps avoid an extra request in many cases
        if (data.length === 0 || (url.includes('per_page=') && data.length < parseInt(url.match(/per_page=(\d+)/)[1]))) {
          break;
        }
      } else {
        // If response is not an array, just return it
        if (logTiming) {
          console.log(`Fetched data in ${Date.now() - startTime}ms (${pageCount} pages)`);
        }
        return data;
      }

      // Check for pagination links in the Link header
      const linkHeader = response.headers.link;
      if (linkHeader) {
        const nextLink = linkHeader.split(',').find(link => link.includes('rel="next"'));
        if (nextLink) {
          const match = nextLink.match(/<([^>]+)>/);
          if (match) {
            // Extract just the path from the full URL
            const fullNextUrl = match[1];
            nextUrl = fullNextUrl.replace(CANVAS_URL, '');
          } else {
            nextUrl = null;
          }
        } else {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    } catch (error) {
      if (error.response && error.response.status === 403) {
        if (!silentErrors) {
          console.error(`Permission denied (403) when accessing ${nextUrl}. This is normal if you don't have access to this resource.`);
        }
        // Return empty array for 403 errors if silentErrors is true
        return silentErrors ? [] : { error: 'Permission denied', status: 403 };
      } else {
        console.error(`Error fetching data from ${nextUrl}:`, error.message);
        if (silentErrors) {
          return [];
        } else {
          throw error;
        }
      }
    }
  }

  if (logTiming) {
    const totalTime = Date.now() - startTime;
    console.log(`Fetched ${allData.length} items in ${totalTime}ms (${pageCount} pages)`);
    console.log('Page timings:', timings);
  }

  return allData;
}

// Routes

// Get current user info
app.get('/api/user', async (req, res) => {
  try {
    const userData = await fetchAllPages('/api/v1/users/self');
    res.json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await fetchAllPages('/api/v1/courses?include[]=term&include[]=teachers&state[]=available');
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error.message);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get assignments for a course
app.get('/api/courses/:courseId/assignments', async (req, res) => {
  try {
    const { courseId } = req.params;
    const assignments = await fetchAllPages(`/api/v1/courses/${courseId}/assignments`);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error.message);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Get submissions for an assignment
app.get('/api/courses/:courseId/assignments/:assignmentId/submissions', async (req, res) => {
  try {
    const { courseId, assignmentId } = req.params;
    const submissions = await fetchAllPages(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`);
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error.message);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Get announcements
app.get('/api/announcements', async (req, res) => {
  try {
    // First get all active courses to build context codes
    const courses = await fetchAllPages('/api/v1/courses?state[]=available');

    // Build context codes for courses (format: course_123)
    const contextCodes = courses.map(course => `course_${course.id}`);

    // If no courses found, return empty array
    if (contextCodes.length === 0) {
      return res.json([]);
    }

    // Build the announcements URL with required parameters
    const announcementsUrl = '/api/v1/announcements?' +
      `context_codes[]=${contextCodes.join('&context_codes[]=')}` + // Add context codes for each course
      '&latest_only=false' + // Get all announcements, not just the latest
      '&start_date=2023-01-01'; // Get announcements from this year

    const announcements = await fetchAllPages(announcementsUrl);
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error.message);
    res.status(500).json({ error: 'Failed to fetch announcements', details: error.message });
  }
});

// Get calendar events
app.get('/api/calendar_events', async (req, res) => {
  try {
    const events = await fetchAllPages('/api/v1/calendar_events');
    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error.message);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Get user's todo items
app.get('/api/todo', async (req, res) => {
  try {
    const todo = await fetchAllPages('/api/v1/users/self/todo');
    res.json(todo);
  } catch (error) {
    console.error('Error fetching todo items:', error.message);
    res.status(500).json({ error: 'Failed to fetch todo items' });
  }
});

// Get current assignments
app.get('/api/current-assignments', async (req, res) => {
  try {
    const startTime = Date.now();
    const timings = {
      courses: { start: 0, end: 0, duration: 0 },
      assignments: { start: 0, end: 0, duration: 0, byCourseDuration: {} },
      processing: { start: 0, end: 0, duration: 0 }
    };

    // Get all active courses
    timings.courses.start = Date.now();
    const courses = await fetchAllPages('/api/v1/courses?include[]=term&state[]=available');
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

        // Use Canvas API parameters to filter assignments by due date
        // bucket=upcoming gets assignments due in the future
        // bucket=past gets assignments that were due in the past
        // Use due_after and due_before to further filter the date range
        const assignmentsUrl = `/api/v1/courses/${course.id}/assignments?` +
          `per_page=50&` + // Increase page size to reduce pagination
          `include[]=submission&` + // Include submission data if available
          `order_by=due_at&` + // Order by due date
          `due_after=${encodeURIComponent(pastCutoffStr)}&` + // Only get assignments due after our cutoff
          `due_before=${encodeURIComponent(futureCutoffStr)}`; // Only get assignments due before future cutoff

        // Get assignments for this course with optimized parameters
        const assignments = await fetchAllPages(assignmentsUrl);

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
});

// Get dashboard data (current assignments, announcements, user info, and courses)
app.get('/api/dashboard', async (req, res) => {
  try {
    const startTime = Date.now();
    const timings = {
      user: { start: 0, end: 0, duration: 0 },
      courses: { start: 0, end: 0, duration: 0 },
      assignments: { start: 0, end: 0, duration: 0, byCourseDuration: {} },
      announcements: { start: 0, end: 0, duration: 0 },
      processing: { start: 0, end: 0, duration: 0 }
    };

    // Create object to store all dashboard data
    const dashboardData = {
      user: null,
      courses: [],
      assignments: [],
      announcements: []
    };

    // Fetch user info
    timings.user.start = Date.now();
    try {
      dashboardData.user = await fetchAllPages('/api/v1/users/self');
    } catch (error) {
      console.error('Error fetching user data:', error.message);
      dashboardData.user = { error: 'Failed to fetch user data' };
    }
    timings.user.end = Date.now();
    timings.user.duration = timings.user.end - timings.user.start;

    // Get all active courses
    timings.courses.start = Date.now();
    let courses = [];
    try {
      courses = await fetchAllPages('/api/v1/courses?include[]=term&state[]=available');
      dashboardData.courses = courses;
    } catch (error) {
      console.error('Error fetching courses:', error.message);
      dashboardData.courses = [];
    }
    timings.courses.end = Date.now();
    timings.courses.duration = timings.courses.end - timings.courses.start;

    // Get current date and calculate date range for filtering assignments
    const now = new Date();
    const pastCutoff = new Date(now);
    pastCutoff.setDate(pastCutoff.getDate() - 7);
    const futureCutoff = new Date(now);
    futureCutoff.setDate(futureCutoff.getDate() + 30); // Get assignments due in next 30 days

    // Format dates for Canvas API
    const pastCutoffStr = pastCutoff.toISOString();
    const futureCutoffStr = futureCutoff.toISOString();

    // Process each course to get assignments with optimized API parameters
    timings.assignments.start = Date.now();

    if (courses.length > 0) {
      // Use Promise.all to fetch assignments for all courses in parallel
      const assignmentPromises = courses.map(async (course) => {
        try {
          const courseStartTime = Date.now();

          // Use Canvas API parameters to filter assignments by due date
          const assignmentsUrl = `/api/v1/courses/${course.id}/assignments?` +
            `per_page=50&` + // Increase page size to reduce pagination
            `include[]=submission&` + // Include submission data if available
            `order_by=due_at&` + // Order by due date
            `due_after=${encodeURIComponent(pastCutoffStr)}&` + // Only get assignments due after our cutoff
            `due_before=${encodeURIComponent(futureCutoffStr)}`; // Only get assignments due before future cutoff

          // Get assignments for this course with optimized parameters
          const assignments = await fetchAllPages(assignmentsUrl);

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

      // Flatten the array of arrays
      dashboardData.assignments = assignmentResults.flat();

      // Sort by due date (ascending)
      dashboardData.assignments.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at) - new Date(b.due_at);
      });
    }

    timings.assignments.end = Date.now();
    timings.assignments.duration = timings.assignments.end - timings.assignments.start;

    // Fetch announcements
    timings.announcements.start = Date.now();
    try {
      // Build context codes for courses (format: course_123)
      const contextCodes = courses.map(course => `course_${course.id}`);

      // If no courses found, set empty array
      if (contextCodes.length === 0) {
        dashboardData.announcements = [];
      } else {
        // Build the announcements URL with required parameters
        const announcementsUrl = '/api/v1/announcements?' +
          `context_codes[]=${contextCodes.join('&context_codes[]=')}` + // Add context codes for each course
          '&latest_only=false' + // Get all announcements, not just the latest
          '&start_date=2023-01-01'; // Get announcements from this year

        dashboardData.announcements = await fetchAllPages(announcementsUrl);

        // Sort announcements by posted date (newest first)
        dashboardData.announcements.sort((a, b) => {
          return new Date(b.posted_at) - new Date(a.posted_at);
        });
      }
    } catch (error) {
      console.error('Error fetching announcements:', error.message);
      dashboardData.announcements = [];
    }
    timings.announcements.end = Date.now();
    timings.announcements.duration = timings.announcements.end - timings.announcements.start;

    // Calculate timing information
    const endTime = Date.now();
    const totalTimeMs = endTime - startTime;

    // Return the dashboard data with detailed timing information
    res.json({
      ...dashboardData,
      counts: {
        courses: dashboardData.courses.length,
        assignments: dashboardData.assignments.length,
        announcements: dashboardData.announcements.length
      },
      timing: {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        totalTimeMs: totalTimeMs,
        totalTimeSec: (totalTimeMs / 1000).toFixed(2),
        totalTimeFormatted: formatTime(totalTimeMs),
        breakdown: {
          user: {
            durationMs: timings.user.duration,
            durationSec: (timings.user.duration / 1000).toFixed(2),
            percentage: ((timings.user.duration / totalTimeMs) * 100).toFixed(1) + '%'
          },
          courses: {
            durationMs: timings.courses.duration,
            durationSec: (timings.courses.duration / 1000).toFixed(2),
            percentage: ((timings.courses.duration / totalTimeMs) * 100).toFixed(1) + '%'
          },
          assignments: {
            durationMs: timings.assignments.duration,
            durationSec: (timings.assignments.duration / 1000).toFixed(2),
            percentage: ((timings.assignments.duration / totalTimeMs) * 100).toFixed(1) + '%',
            byCourseDuration: timings.assignments.byCourseDuration
          },
          announcements: {
            durationMs: timings.announcements.duration,
            durationSec: (timings.announcements.duration / 1000).toFixed(2),
            percentage: ((timings.announcements.duration / totalTimeMs) * 100).toFixed(1) + '%'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error.message);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get user grades across all courses (detailed version)
app.get('/api/grades', async (req, res) => {
  try {
    // First get all courses
    const courses = await fetchAllPages('/api/v1/courses?include[]=term&state[]=available');

    // Then get grades for each course
    const gradesPromises = courses.map(async (course) => {
      try {
        const submissions = await fetchAllPages(`/api/v1/courses/${course.id}/students/submissions?student_ids[]=self`, { silentErrors: true });
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
});

// Get current term grades only (fast endpoint)
app.get('/api/current-term-grades', async (req, res) => {
  try {
    const startTime = Date.now();
    const timings = {
      courses: { start: 0, end: 0, duration: 0 },
      processing: { start: 0, end: 0, duration: 0 }
    };

    // Get all active courses with the correct parameters for grades
    timings.courses.start = Date.now();

    // We need to include total_scores to get the grades and enrollment_term to filter by current term
    const courses = await fetchAllPages('/api/v1/courses?include[]=total_scores&include[]=term&state[]=available', { logTiming: false });

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
});

// Get current grades only (fast endpoint)
app.get('/api/current-grades', async (req, res) => {
  try {
    const startTime = Date.now();
    const timings = {
      courses: { start: 0, end: 0, duration: 0 },
      grades: { start: 0, end: 0, duration: 0, byCourseDuration: {} },
      processing: { start: 0, end: 0, duration: 0 }
    };

    // Get all active courses with the correct parameters for grades
    timings.courses.start = Date.now();

    // We need to include total_scores to get the grades
    const courses = await fetchAllPages('/api/v1/courses?include[]=total_scores&include[]=term&state[]=available', { logTiming: false });

    // Log the first course to see its structure (for debugging)
    if (courses.length > 0) {
      console.log('First course structure:', JSON.stringify({
        id: courses[0].id,
        name: courses[0].name,
        enrollments: courses[0].enrollments ?
          courses[0].enrollments.map(e => ({
            type: e.type,
            computed_current_score: e.computed_current_score,
            computed_final_score: e.computed_final_score,
            computed_current_grade: e.computed_current_grade
          })) : 'No enrollments'
      }, null, 2));
    }

    timings.courses.end = Date.now();
    timings.courses.duration = timings.courses.end - timings.courses.start;

    // Process grades
    timings.processing.start = Date.now();

    // Extract just the grade information from each course
    const gradesData = courses.map(course => {
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
});

// Get all data for a user
app.get('/api/all-data', async (req, res) => {
  try {
    // Start the timer
    const startTime = Date.now();

    // Create an object to store all the data
    const allData = {
      user: null,
      courses: [],
      announcements: [],
      calendarEvents: [],
      conversations: [],
      grades: [],
      todo: [],
      accessibleData: {}, // Track what data was accessible
      errors: [], // Track any errors
      timing: {
        startTime: new Date().toISOString(),
        endTime: null,
        totalTimeMs: null,
        totalTimeSec: null,
        sections: {} // Will store timing for each section
      }
    };

    // Fetch user info
    try {
      const userStartTime = Date.now();
      allData.user = await fetchAllPages('/api/v1/users/self');
      allData.accessibleData.user = true;
      allData.timing.sections.user = {
        timeMs: Date.now() - userStartTime,
        timeSec: ((Date.now() - userStartTime) / 1000).toFixed(2)
      };
    } catch (error) {
      allData.errors.push({ endpoint: 'user', message: error.message });
      allData.accessibleData.user = false;
    }

    // Fetch courses
    let courses = [];
    try {
      const coursesStartTime = Date.now();
      courses = await fetchAllPages('/api/v1/courses?include[]=term&include[]=teachers&state[]=available');
      allData.accessibleData.courses = true;
      allData.timing.sections.courses = {
        timeMs: Date.now() - coursesStartTime,
        timeSec: ((Date.now() - coursesStartTime) / 1000).toFixed(2)
      };
    } catch (error) {
      allData.errors.push({ endpoint: 'courses', message: error.message });
      allData.accessibleData.courses = false;
    }

    // Fetch assignments, submissions, and other data for each course
    if (courses.length > 0) {
      const courseDetailsStartTime = Date.now();
      const coursesWithDetails = await Promise.all(
        courses.map(async (course) => {
          const courseId = course.id;
          const courseStartTime = Date.now();
          const courseData = {
            ...course,
            accessibleData: {},
            timing: { startTime: Date.now() } // Track timing for each course
          };

          // Fetch assignments
          try {
            const assignments = await fetchAllPages(`/api/v1/courses/${courseId}/assignments`);
            courseData.assignments = [];
            courseData.accessibleData.assignments = true;

            // Fetch submissions for each assignment - use silentErrors to continue even with 403s
            if (assignments.length > 0) {
              for (const assignment of assignments) {
                try {
                  // Use silentErrors option to prevent console spam for expected 403s
                  const submissions = await fetchAllPages(
                    `/api/v1/courses/${courseId}/assignments/${assignment.id}/submissions`,
                    { silentErrors: true }
                  );

                  courseData.assignments.push({
                    ...assignment,
                    submissions: Array.isArray(submissions) ? submissions : []
                  });
                } catch (error) {
                  // Just add the assignment without submissions
                  courseData.assignments.push({
                    ...assignment,
                    submissions: [],
                    submissionsError: 'Permission denied'
                  });
                }
              }
            }
          } catch (error) {
            courseData.assignments = [];
            courseData.accessibleData.assignments = false;
          }

          // Fetch modules
          try {
            courseData.modules = await fetchAllPages(`/api/v1/courses/${courseId}/modules?include[]=items`);
            courseData.accessibleData.modules = true;
          } catch (error) {
            courseData.modules = [];
            courseData.accessibleData.modules = false;
          }

          // Fetch discussion topics
          try {
            courseData.discussions = await fetchAllPages(`/api/v1/courses/${courseId}/discussion_topics`);
            courseData.accessibleData.discussions = true;
          } catch (error) {
            courseData.discussions = [];
            courseData.accessibleData.discussions = false;
          }

          // Fetch files
          try {
            courseData.files = await fetchAllPages(`/api/v1/courses/${courseId}/files`);
            courseData.accessibleData.files = true;
          } catch (error) {
            courseData.files = [];
            courseData.accessibleData.files = false;
          }

          // Fetch pages
          try {
            courseData.pages = await fetchAllPages(`/api/v1/courses/${courseId}/pages`);
            courseData.accessibleData.pages = true;
          } catch (error) {
            courseData.pages = [];
            courseData.accessibleData.pages = false;
          }

          // Fetch grades
          try {
            courseData.grades = await fetchAllPages(`/api/v1/courses/${courseId}/students/submissions?student_ids[]=self`);
            courseData.accessibleData.grades = true;
          } catch (error) {
            courseData.grades = [];
            courseData.accessibleData.grades = false;
          }

          // Add timing information for this course
          courseData.timing.endTime = Date.now();
          courseData.timing.totalTimeMs = courseData.timing.endTime - courseStartTime;
          courseData.timing.totalTimeSec = (courseData.timing.totalTimeMs / 1000).toFixed(2);

          return courseData;
        })
      );

      allData.courses = coursesWithDetails;

      // Add timing for all course details
      allData.timing.sections.courseDetails = {
        timeMs: Date.now() - courseDetailsStartTime,
        timeSec: ((Date.now() - courseDetailsStartTime) / 1000).toFixed(2),
        coursesProcessed: coursesWithDetails.length
      };
    }

    // Fetch announcements
    try {
      const announcementsStartTime = Date.now();

      // Build context codes for courses (format: course_123)
      const contextCodes = courses.map(course => `course_${course.id}`);

      // If no courses found, set empty array
      if (contextCodes.length === 0) {
        allData.announcements = [];
      } else {
        // Build the announcements URL with required parameters
        const announcementsUrl = '/api/v1/announcements?' +
          `context_codes[]=${contextCodes.join('&context_codes[]=')}` + // Add context codes for each course
          '&latest_only=false' + // Get all announcements, not just the latest
          '&start_date=2023-01-01'; // Get announcements from this year

        allData.announcements = await fetchAllPages(announcementsUrl);
      }

      allData.accessibleData.announcements = true;
      allData.timing.sections.announcements = {
        timeMs: Date.now() - announcementsStartTime,
        timeSec: ((Date.now() - announcementsStartTime) / 1000).toFixed(2)
      };
    } catch (error) {
      allData.errors.push({ endpoint: 'announcements', message: error.message });
      allData.accessibleData.announcements = false;
    }

    // Fetch calendar events
    try {
      const calendarStartTime = Date.now();
      allData.calendarEvents = await fetchAllPages('/api/v1/calendar_events');
      allData.accessibleData.calendarEvents = true;
      allData.timing.sections.calendarEvents = {
        timeMs: Date.now() - calendarStartTime,
        timeSec: ((Date.now() - calendarStartTime) / 1000).toFixed(2)
      };
    } catch (error) {
      allData.errors.push({ endpoint: 'calendarEvents', message: error.message });
      allData.accessibleData.calendarEvents = false;
    }

    // Fetch conversations (inbox messages)
    try {
      const conversationsStartTime = Date.now();
      allData.conversations = await fetchAllPages('/api/v1/conversations');
      allData.accessibleData.conversations = true;
      allData.timing.sections.conversations = {
        timeMs: Date.now() - conversationsStartTime,
        timeSec: ((Date.now() - conversationsStartTime) / 1000).toFixed(2)
      };
    } catch (error) {
      allData.errors.push({ endpoint: 'conversations', message: error.message });
      allData.accessibleData.conversations = false;
    }

    // Fetch todo items
    try {
      const todoStartTime = Date.now();
      allData.todo = await fetchAllPages('/api/v1/users/self/todo');
      allData.accessibleData.todo = true;
      allData.timing.sections.todo = {
        timeMs: Date.now() - todoStartTime,
        timeSec: ((Date.now() - todoStartTime) / 1000).toFixed(2)
      };
    } catch (error) {
      allData.errors.push({ endpoint: 'todo', message: error.message });
      allData.accessibleData.todo = false;
    }

    // Calculate total time and add timestamps
    const endTime = Date.now();
    allData.timing.endTime = new Date().toISOString();
    allData.timing.totalTimeMs = endTime - startTime;
    allData.timing.totalTimeSec = (allData.timing.totalTimeMs / 1000).toFixed(2);
    allData.timing.totalTimeFormatted = formatTime(allData.timing.totalTimeMs);
    allData.timestamp = new Date().toISOString();

    res.json(allData);
  } catch (error) {
    console.error('Error fetching all data:', error.message);

    // Calculate time even for errors
    const endTime = Date.now();
    const totalTimeMs = endTime - startTime;

    res.status(500).json({
      error: 'Failed to fetch all data',
      details: error.message,
      timestamp: new Date().toISOString(),
      timing: {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        totalTimeMs: totalTimeMs,
        totalTimeSec: (totalTimeMs / 1000).toFixed(2),
        totalTimeFormatted: formatTime(totalTimeMs)
      }
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Canvas API URL: ${CANVAS_URL}`);
});
