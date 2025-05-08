// Temporary script to find Spring 2025 courses
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Canvas API configuration
const canvasAPI = axios.create({
  baseURL: process.env.CANVAS_URL,
  headers: {
    'Authorization': `Bearer ${process.env.CANVAS_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Function to handle paginated API requests
 * @param {string} url - API endpoint URL
 * @returns {Promise<Array|Object>} - Resolved data from all pages
 */
async function fetchAllPages(url) {
  let allData = [];
  let nextUrl = url;
  let pageCount = 0;

  while (nextUrl && pageCount < 10) {
    pageCount++;

    try {
      // Add a cache buster to avoid browser caching
      const separator = nextUrl.includes('?') ? '&' : '?';
      const urlWithCacheBuster = `${nextUrl}${separator}_=${Date.now()}`;

      const response = await canvasAPI.get(urlWithCacheBuster);
      const data = response.data;

      if (Array.isArray(data)) {
        allData = [...allData, ...data];
      } else {
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
            nextUrl = fullNextUrl.replace(process.env.CANVAS_URL, '');
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
      console.error(`Error fetching data from ${nextUrl}:`, error.message);
      throw error;
    }
  }

  return allData;
}

// Main function to find Spring 2025 courses
async function findSpring2025Courses() {
  try {
    console.log('Fetching all available courses...');

    // Get all courses with term information
    const courses = await fetchAllPages('/api/v1/courses?state[]=available&include[]=term');

    console.log(`Found ${courses.length} total courses`);

    // Show all courses with their terms
    console.log('\nAll available courses with terms:');
    courses.forEach(course => {
      const termName = course.term ? course.term.name : 'No term';
      console.log(`- ${course.name} (ID: ${course.id}, Code: ${course.course_code}, Term: ${termName})`);
    });

    // Ask user to select Spring 2025 courses manually
    console.log('\nPlease identify the Spring 2025 courses from the list above.');
    console.log('Then add a line like this to your .env file:');
    console.log('SPRING_2025_COURSE_IDS=123,456,789');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the function
findSpring2025Courses();
