const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireOrganizer } = require('../middleware/role');
const {
  getEventRegistrations, getUserRegistrations, createRegistration,
  cancelRegistration, getRegistrationCount, getRegistration,
  getEventById, getUserById, updateRegistrationQR
} = require('../db/queries');

const router = express.Router();

// GET /api/registrations/mine — current user's registrations
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const registrations = await getUserRegistrations(req.user.id);
    res.json({ data: registrations, total: registrations.length, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registrations', detail: err.message });
  }
});

// GET /api/events/:id/registrations — list registrants (in events.js scope, mounted separately)
// This is handled via the event-scoped registrations below

module.exports = router;
