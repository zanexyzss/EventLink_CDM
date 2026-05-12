const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireOrganizer } = require('../middleware/role');
const { getEventAttendance, markAttendance, getAttendanceStatus, getUserById, getEventById, getRegistration } = require('../db/queries');

const router = express.Router();

// GET /api/events/:eventId/attendance — list attendance
router.get('/:eventId', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const attendance = await getEventAttendance(eventId);
    res.json({ data: attendance, total: attendance.length, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance', detail: err.message });
  }
});

// POST /api/events/:eventId/attendance — mark present
router.post('/:eventId', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { user_id, method = 'manual' } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const user = await getUserById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if user is registered for this event
    const registration = await getRegistration(eventId, user_id);
    if (!registration) return res.status(400).json({ error: 'User is not registered for this event' });

    const existing = await getAttendanceStatus(eventId, user_id);
    if (existing) return res.status(409).json({ error: 'User already marked as present', data: existing });

    const record = await markAttendance(eventId, user_id, method);
    res.status(201).json({ data: record, message: 'Attendance marked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark attendance', detail: err.message });
  }
});

// GET /api/events/:eventId/attendance/:userId — check status
router.get('/:eventId/:userId', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = parseInt(req.params.userId);
    const status = await getAttendanceStatus(eventId, userId);
    res.json({ data: status, attended: !!status, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check attendance', detail: err.message });
  }
});

module.exports = router;
