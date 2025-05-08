# Canvas Data API Server

This Express.js server pulls all Canvas LMS data for a user using their API key.

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your `.env` file with your Canvas URL and API key:
   ```
   CANVAS_URL=https://your-institution.instructure.com
   CANVAS_API_KEY=your_api_key_here
   ```

## Running the Server

Start the server in development mode:
```
npm run dev
```

Or in production mode:
```
npm start
```

The server will run on port 3000 by default. You can change this by setting the `PORT` environment variable in your `.env` file.

## Available Endpoints

### Get All Data
```
GET /api/all-data
```
Fetches all available Canvas data for the authenticated user, including:
- User information
- Courses (with assignments, submissions, modules, discussions, files, and pages)
- Announcements
- Calendar events
- Conversations (inbox messages)
- Todo items
- Grades

This endpoint handles permission errors gracefully and will return as much data as your Canvas API key has access to. It also includes:
- An `accessibleData` object that indicates which data types were successfully retrieved
- A `timing` object that shows detailed performance metrics for each section of data fetched

### Individual Endpoints

- **User Information**: `GET /api/user`
- **Courses**: `GET /api/courses`
- **Course Assignments**: `GET /api/courses/:courseId/assignments`
- **Assignment Submissions**: `GET /api/courses/:courseId/assignments/:assignmentId/submissions`
- **Announcements**: `GET /api/announcements`
- **Calendar Events**: `GET /api/calendar_events`
- **Todo Items**: `GET /api/todo`
- **Grades**: `GET /api/grades`

### Error Handling

The server handles permission errors (403) gracefully. This is important because Canvas restricts access to certain data based on user roles. For example, students typically cannot access other students' submissions, so 403 errors are expected for those endpoints.

When using the `/api/all-data` endpoint, the server will:
1. Continue fetching other data even if some endpoints return permission errors
2. Include an `accessibleData` object that shows which data types were accessible
3. Include an `errors` array with details about any errors encountered
4. Include detailed timing information for performance monitoring

### Performance Timing

The `/api/all-data` endpoint includes comprehensive timing information:

```json
{
  "timing": {
    "startTime": "2023-06-01T12:00:00.000Z",
    "endTime": "2023-06-01T12:01:30.000Z",
    "totalTimeMs": 90000,
    "totalTimeSec": "90.00",
    "totalTimeFormatted": "1m 30s",
    "sections": {
      "user": { "timeMs": 500, "timeSec": "0.50" },
      "courses": { "timeMs": 1200, "timeSec": "1.20" },
      "courseDetails": {
        "timeMs": 75000,
        "timeSec": "75.00",
        "coursesProcessed": 10
      },
      "announcements": { "timeMs": 3500, "timeSec": "3.50" },
      "calendarEvents": { "timeMs": 4200, "timeSec": "4.20" },
      "conversations": { "timeMs": 3800, "timeSec": "3.80" },
      "todo": { "timeMs": 1800, "timeSec": "1.80" }
    }
  }
}
```

Each course also includes its own timing information, allowing you to identify which courses take the longest to process.

## How to Get Your Canvas API Key

1. Log in to your Canvas account
2. Go to Account > Settings
3. Scroll down to the "Approved Integrations" section
4. Click on "+ New Access Token"
5. Enter a purpose and expiration date
6. Click "Generate Token"
7. Copy the token and add it to your `.env` file

## Notes

- This server handles pagination automatically for all Canvas API requests
- All data is returned in JSON format
- Error handling is implemented for all endpoints
