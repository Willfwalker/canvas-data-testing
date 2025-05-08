const express = require('express');
const userRoutes = require('./userRoutes');
const courseRoutes = require('./courseRoutes');
const assignmentRoutes = require('./assignmentRoutes');
const announcementRoutes = require('./announcementRoutes');
const gradeRoutes = require('./gradeRoutes');
const dashboardRoutes = require('./dashboardRoutes');

const router = express.Router();

// Prefix all routes with /api
router.use('/api', userRoutes);
router.use('/api', courseRoutes);
router.use('/api', assignmentRoutes);
router.use('/api', announcementRoutes);
router.use('/api', gradeRoutes);
router.use('/api', dashboardRoutes);

module.exports = router;
