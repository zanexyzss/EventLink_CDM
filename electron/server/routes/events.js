const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireOrganizer } = require('../middleware/role');
const { getAllEvents, getEventById, createEvent, updateEvent, deleteEvent, getAllUsers } = require('../db/queries');

const router = express.Router();

// GET /api/events — list events
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search, type, limit = 20, offset = 0 } = req.query;
    const filters = { search, type, limit: parseInt(limit), offset: parseInt(offset) };

    // Students only see open events; admins/organizers see all
    if (req.user.role === 'student') {
      filters.status = 'open';
    } else if (status) {
      filters.status = status;
    }

    const { events, total } = await getAllEvents(filters);
    res.json({ data: events, total, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events', detail: err.message });
  }
});

// POST /api/events — create event
router.post('/', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const { title, description, event_type, venue, event_date, registration_deadline, max_slots, status } = req.body;
    if (!title || !event_date) return res.status(400).json({ error: 'Title and event date are required' });

    const event = await createEvent({
      title, description, event_type, venue, event_date,
      registration_deadline, max_slots,
      organizer_id: req.user.id,
      status: status || 'draft'
    });

    res.status(201).json({ data: event, message: 'Event created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event', detail: err.message });
  }
});

// GET /api/events/:id — event detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const event = await getEventById(parseInt(req.params.id));
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ data: event, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event', detail: err.message });
  }
});

// PUT /api/events/:id — update event
router.put('/:id', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const existing = await getEventById(eventId);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    // Organizers can only update their own events
    if (req.user.role === 'organizer' && existing.organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own events' });
    }

    const event = await updateEvent(eventId, req.body);
    res.json({ data: event, message: 'Event updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event', detail: err.message });
  }
});

// DELETE /api/events/:id — delete event
router.delete('/:id', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const existing = await getEventById(eventId);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role === 'organizer' && existing.organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own events' });
    }

    await deleteEvent(eventId);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event', detail: err.message });
  }
});

// POST /api/events/:id/open — open registration + send announcements
router.post('/:id/open', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const existing = await getEventById(eventId);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const event = await updateEvent(eventId, { status: 'open' });

    // Send announcement emails to all students
    try {
      const { bulkSendAnnouncement } = require('../services/emailService');
      const { users: students } = await getAllUsers({ role: 'student', limit: 10000 });
      if (students.length > 0) {
        bulkSendAnnouncement(students, event).catch(err => console.error('[EMAIL] Bulk send error:', err));
      }
    } catch (emailErr) {
      console.error('[EMAIL] Announcement error:', emailErr.message);
    }

    res.json({ data: event, message: 'Event opened for registration' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to open event', detail: err.message });
  }
});

// POST /api/events/:id/close — close registration
router.post('/:id/close', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const existing = await getEventById(eventId);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const event = await updateEvent(eventId, { status: 'closed' });
    res.json({ data: event, message: 'Registration closed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to close event', detail: err.message });
  }
});

// POST /api/events/:id/complete — mark as completed
router.post('/:id/complete', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const existing = await getEventById(eventId);
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    const event = await updateEvent(eventId, { status: 'completed' });
    res.json({ data: event, message: 'Event completed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete event', detail: err.message });
  }
});

module.exports = router;
