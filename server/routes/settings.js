const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const { getAllSettings, setSetting } = require('../db/queries');

const router = express.Router();

// GET /api/settings — all settings
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json({ data: settings, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings', detail: err.message });
  }
});

// PUT /api/settings — update settings
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Settings object required' });
    }

    for (const [key, value] of Object.entries(updates)) {
      await setSetting(key, String(value));
    }

    const settings = await getAllSettings();
    res.json({ data: settings, message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings', detail: err.message });
  }
});

// POST /api/settings/test-email — send a real test email
router.post('/test-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sendEmail } = require('../services/emailService');
    const recipient = req.body?.recipient || process.env.EMAIL_USER || req.user.email;
    const result = await sendEmail({
      to: recipient,
      subject: '✅ EVENTLINK CDM — Test Email',
      type: 'test',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <div style="background:#1e3a8a;color:white;padding:24px;text-align:center">
            <h1 style="margin:0;font-size:24px">EVENTLINK CDM</h1>
            <p style="margin:4px 0 0;opacity:.8">Email Configuration Test</p>
          </div>
          <div style="padding:32px;text-align:center">
            <div style="width:64px;height:64px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
              <span style="color:white;font-size:32px">✓</span>
            </div>
            <h2 style="color:#16a34a;margin:0 0 8px">Email is Working!</h2>
            <p style="color:#64748b">This test email confirms your Resend API is configured correctly.</p>
            <p style="color:#94a3b8;font-size:14px;margin-top:16px">
              Sent at: ${new Date().toLocaleString()}<br>
              Via: Resend HTTP API
            </p>
          </div>
          <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:12px">
            EVENTLINK CDM — Campus Event Management System
          </div>
        </div>
      `
    });

    if (result.success) {
      res.json({ message: `Test email sent to ${recipient}`, data: { sent: true } });
    } else {
      res.status(500).json({ error: `Email failed: ${result.error}`, data: { sent: false } });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test email', detail: err.message });
  }
});

// POST /api/settings/test-certificate-email — send a certificate email to yourself for testing
router.post('/test-certificate-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const certFs = require('fs');
    const { sendCertificate } = require('../services/emailService');
    const { getEventById, getUserById } = require('../db/queries');
    const { queryAll } = require('../db/database');
    
    // Find the first available certificate
    const allCerts = await queryAll("SELECT * FROM certificates WHERE file_path IS NOT NULL ORDER BY id DESC LIMIT 1", []);
    
    if (allCerts.length === 0) {
      return res.status(400).json({ error: 'No certificates found in database. Generate one first.' });
    }
    
    const cert = allCerts[0];
    const event = await getEventById(cert.event_id);
    const user = await getUserById(cert.user_id);
    
    console.log('[TEST CERT EMAIL] Certificate:', { id: cert.id, file_path: cert.file_path });
    console.log('[TEST CERT EMAIL] File exists:', certFs.existsSync(cert.file_path));
    
    // Send to ADMIN's email so we can confirm delivery
    const adminEmail = process.env.EMAIL_USER;
    const testUser = { ...user, email: adminEmail };
    
    console.log('[TEST CERT EMAIL] Sending to', adminEmail);
    const result = await sendCertificate(testUser, event, cert.file_path);
    console.log('[TEST CERT EMAIL] Result:', result);
    
    if (result.success) {
      res.json({ 
        message: `Test certificate email sent to ${adminEmail}! Check your inbox.`,
        data: { sent: true, messageId: result.messageId }
      });
    } else {
      res.status(500).json({ error: `Failed: ${result.error}`, data: { sent: false } });
    }
  } catch (err) {
    console.error('[TEST CERT EMAIL] Error:', err);
    res.status(500).json({ error: 'Failed to send test certificate email', detail: err.message });
  }
});

module.exports = router;
