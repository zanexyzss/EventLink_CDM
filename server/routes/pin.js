const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { requireOrganizer } = require('../middleware/role');
const { getEventById, getRegistration, markAttendance, getAttendanceStatus } = require('../db/queries');
const { queryAll, queryOne, runSql } = require('../db/database');

const router = express.Router();

// ─── Helper: generate a 6-digit PIN ────────────────────────
function generatePin() {
  return crypto.randomInt(100000, 999999).toString();
}

// ─── POST /api/pin/:eventId/generate — Admin generates/rotates a PIN ───
router.post('/:eventId/generate', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Duration in minutes (default 3 min)
    const durationMinutes = parseInt(req.body.duration) || 3;

    // Deactivate any existing PINs for this event
    await runSql('UPDATE event_pins SET is_active = 0 WHERE event_id = ?', [eventId]);

    // Generate new PIN
    const pinCode = generatePin();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    await runSql(
      'INSERT INTO event_pins (event_id, pin_code, created_at, expires_at, is_active) VALUES (?, ?, ?, ?, 1)',
      [eventId, pinCode, now.toISOString(), expiresAt.toISOString()]
    );

    console.log(`[PIN] Generated PIN ${pinCode} for event ${eventId}, expires in ${durationMinutes}m`);

    res.json({
      data: {
        pin: pinCode,
        expires_at: expiresAt.toISOString(),
        duration_minutes: durationMinutes,
        event_id: eventId
      },
      message: 'PIN generated'
    });
  } catch (err) {
    console.error('[PIN] Generate error:', err);
    res.status(500).json({ error: 'Failed to generate PIN', detail: err.message });
  }
});

// ─── GET /api/pin/:eventId/active — Admin gets the current active PIN ───
router.get('/:eventId/active', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const now = new Date().toISOString();

    const pin = await queryOne(
      'SELECT * FROM event_pins WHERE event_id = ? AND is_active = 1 AND expires_at > ? ORDER BY id DESC LIMIT 1',
      [eventId, now]
    );

    if (!pin) {
      return res.json({ data: null, message: 'No active PIN' });
    }

    res.json({
      data: {
        pin: pin.pin_code,
        expires_at: pin.expires_at,
        created_at: pin.created_at,
        event_id: eventId
      },
      message: 'Active PIN'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get active PIN', detail: err.message });
  }
});

// ─── POST /api/pin/:eventId/stop — Admin stops/deactivates all PINs ───
router.post('/:eventId/stop', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    await runSql('UPDATE event_pins SET is_active = 0 WHERE event_id = ?', [eventId]);
    console.log(`[PIN] Stopped all PINs for event ${eventId}`);
    res.json({ message: 'Check-in stopped' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop check-in', detail: err.message });
  }
});

// ─── POST /api/pin/:eventId/checkin — Student submits PIN to check in ───
router.post('/:eventId/checkin', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = req.user.id;
    const { pin } = req.body;

    if (!pin || pin.length !== 6) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit PIN' });
    }

    // 1. Check event exists
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // 2. Check user is registered
    const registration = await getRegistration(eventId, userId);
    if (!registration) {
      return res.status(403).json({ error: 'You are not registered for this event' });
    }

    // 3. Check if already checked in
    const existing = await getAttendanceStatus(eventId, userId);
    if (existing) {
      return res.status(409).json({ error: 'You have already checked in for this event', data: existing });
    }

    // 4. Validate PIN — must be active and not expired
    const now = new Date().toISOString();
    const activePin = await queryOne(
      'SELECT * FROM event_pins WHERE event_id = ? AND pin_code = ? AND is_active = 1 AND expires_at > ?',
      [eventId, pin, now]
    );

    if (!activePin) {
      console.log(`[PIN] Invalid/expired PIN attempt: user ${userId}, event ${eventId}, pin ${pin}`);
      return res.status(400).json({ error: 'Invalid or expired PIN. Please check the screen and try again.' });
    }

    // 5. Mark attendance with method 'pin'
    const record = await markAttendance(eventId, userId, 'pin');
    console.log(`[PIN] Check-in success: user ${userId} → event ${eventId}`);

    res.status(201).json({
      data: record,
      message: 'Check-in successful! Your attendance has been recorded. ✅'
    });
  } catch (err) {
    console.error('[PIN] Check-in error:', err);
    res.status(500).json({ error: 'Check-in failed', detail: err.message });
  }
});

// ─── GET /api/pin/:eventId/status — Student checks their own check-in status ───
router.get('/:eventId/status', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = req.user.id;
    const status = await getAttendanceStatus(eventId, userId);
    const registration = await getRegistration(eventId, userId);

    res.json({
      data: {
        registered: !!registration,
        checked_in: !!status,
        checked_in_at: status?.checked_in_at || null,
        method: status?.method || null
      },
      message: 'OK'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check status', detail: err.message });
  }
});

module.exports = router;
