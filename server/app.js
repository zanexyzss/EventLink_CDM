const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./db/database');

const app = express();
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'https://event-link-cdm.vercel.app',
    'http://localhost:5173'
  ]
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../../assets/uploads')));

// ─── Event-scoped registration routes ───
const { authenticateToken } = require('./middleware/auth');
const { requireOrganizer } = require('./middleware/role');

// These require DB to be initialized — we wrap in async startup
async function startServer() {
  // Initialize DB first (sql.js is async)
  await initDatabase();
  console.log('[SERVER] Database ready');

  // Verify Email Transporter
  const { verifyTransporter } = require('./services/emailService');
  await verifyTransporter();

  const {
    getEventRegistrations, createRegistration, cancelRegistration,
    getRegistrationCount, getRegistration, getEventById, getUserById, updateRegistrationQR, updateRegistrationQRData
  } = require('./db/queries');

  // GET /api/events/:id/registrations
  app.get('/api/events/:id/registrations', authenticateToken, requireOrganizer, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await getEventById(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      const registrations = await getEventRegistrations(eventId);
      res.json({ data: registrations, total: registrations.length, message: 'OK' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch registrations', detail: err.message });
    }
  });

  // POST /api/events/:id/register
  app.post('/api/events/:id/register', authenticateToken, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user.id;

      const event = await getEventById(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.status !== 'open') return res.status(400).json({ error: 'Event is not open for registration' });

      if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
        return res.status(400).json({ error: 'Registration deadline has passed' });
      }

      if (event.max_slots) {
        const count = await getRegistrationCount(eventId);
        if (count >= event.max_slots) return res.status(400).json({ error: 'No slots available' });
      }

      const existing = await getRegistration(eventId, userId);
      if (existing) return res.status(409).json({ error: 'You are already registered for this event' });

      await createRegistration(eventId, userId);
      // Re-fetch the registration to ensure we have the full record
      let registration = await getRegistration(eventId, userId) || {};

      // Generate QR code (non-blocking)
      let qrData = null;
      try {
        const { generateRegistrationQR } = require('./services/qrService');
        qrData = await generateRegistrationQR(userId, eventId);
        updateRegistrationQRData(eventId, userId, qrData);
        registration.qr_code_data = qrData;
      } catch (qrErr) {
        console.error('[QR] Generation error:', qrErr.message);
      }

      // Send confirmation email (non-blocking — fire and forget)
      try {
        const { sendRegistrationConfirmation } = require('./services/emailService');
        const user = await getUserById(userId);
        if (user) {
          sendRegistrationConfirmation(user, event, qrData).catch(e => console.error('[EMAIL]', e.message));
        }
      } catch (emailErr) {
        console.error('[EMAIL] Confirmation error:', emailErr.message);
      }

      res.status(201).json({ data: registration, message: 'Registration confirmed' });
    } catch (err) {
      res.status(500).json({ error: 'Registration failed', detail: err.message });
    }
  });

  // DELETE /api/events/:id/register
  app.delete('/api/events/:id/register', authenticateToken, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const existing = await getRegistration(eventId, req.user.id);
      if (!existing) return res.status(404).json({ error: 'Registration not found' });

      await cancelRegistration(eventId, req.user.id);
      res.json({ message: 'Registration cancelled' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to cancel registration', detail: err.message });
    }
  });

  // ─── Mount route files ───
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/events', require('./routes/events'));
  app.use('/api/registrations', require('./routes/registrations'));
  app.use('/api/attendance', require('./routes/attendance'));
  app.use('/api/pin', require('./routes/pin'));
  app.use('/api/certificates', require('./routes/certificates'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/settings', require('./routes/settings'));

  // Health check
  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.stack);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`[SERVER] EVENTLINK API running on http://localhost:${PORT}`));
}

startServer().catch(err => {
  console.error('[FATAL] Server failed to start:', err);
  process.exit(1);
});

module.exports = app;
