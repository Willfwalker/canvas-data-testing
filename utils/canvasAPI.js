const canvasAPI = require('../config/canvas');
const env = require('../config/env');

/**
 * Function to handle paginated API requests with optimized pagination
 * @param {string} url - API endpoint URL
 * @param {Object} options - Options for the request
 * @returns {Promise<Array|Object>} - Resolved data from all pages
 */
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
            nextUrl = fullNextUrl.replace(env.CANVAS_URL, '');
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

module.exports = { fetchAllPages };
