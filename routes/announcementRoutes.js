const express = require('express');
const announcementController = require('../controllers/announcementController');

const router = express.Router();

// Get announcements for all available courses
router.get('/announcements', announcementController.getAnnouncements);

module.exports = router;
