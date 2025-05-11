const express = require('express');
const userRoutes = require('./userRoutes');
const courseRoutes = require('./courseRoutes');
const assignmentRoutes = require('./assignmentRoutes');
const announcementRoutes = require('./announcementRoutes');
const gradeRoutes = require('./gradeRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const springCoursesRoutes = require('./springCoursesRoutes');
const assignmentGradesRoutes = require('./assignmentGradesRoutes');
const twoStageRoutes = require('./twoStageRoutes');

const router = express.Router();

// Mount all routes directly (no additional /api prefix)
router.use('/', userRoutes);
router.use('/', courseRoutes);
router.use('/', assignmentRoutes);
router.use('/', announcementRoutes);
router.use('/', gradeRoutes);
router.use('/', dashboardRoutes);
router.use('/', springCoursesRoutes);
router.use('/', assignmentGradesRoutes);
router.use('/', twoStageRoutes);

module.exports = router;
