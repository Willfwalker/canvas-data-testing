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

// Function to handle paginated API requests
async function fetchAllPages(url, options = {}) {
  const { silentErrors = false } = options;
  let allData = [];
  let nextUrl = url;

  while (nextUrl) {
    try {
      const response = await canvasAPI.get(nextUrl);
      const data = response.data;

      if (Array.isArray(data)) {
        allData = [...allData, ...data];
      } else {
        // If response is not an array, just return it
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
    const announcements = await fetchAllPages('/api/v1/announcements');
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error.message);
    res.status(500).json({ error: 'Failed to fetch announcements' });
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

// Get user grades across all courses
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
      allData.announcements = await fetchAllPages('/api/v1/announcements');
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
