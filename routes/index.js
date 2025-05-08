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

// Prefix all routes with /api
router.use('/api', userRoutes);
router.use('/api', courseRoutes);
router.use('/api', assignmentRoutes);
router.use('/api', announcementRoutes);
router.use('/api', gradeRoutes);
router.use('/api', dashboardRoutes);
router.use('/api', springCoursesRoutes);
router.use('/api', assignmentGradesRoutes);
router.use('/api', twoStageRoutes);

module.exports = router;
