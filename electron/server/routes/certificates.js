const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { requireOrganizer } = require('../middleware/role');
const {
  getEventCertificates, getUserCertificates, getEventAttendance,
  getEventById, getUserById
} = require('../db/queries');
const { queryOne, runSql } = require('../db/database');

const router = express.Router();

// GET /api/certificates/mine — my certificates
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const certs = await getUserCertificates(req.user.id);
    res.json({ data: certs, total: certs.length, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch certificates', detail: err.message });
  }
});

// GET /api/certificates/:eventId — list certificates for event
router.get('/:eventId', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const certs = await getEventCertificates(eventId);
    res.json({ data: certs, total: certs.length, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch certificates', detail: err.message });
  }
});

// POST /api/certificates/:eventId/generate — bulk generate ALL
router.post('/:eventId/generate', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const attendance = await getEventAttendance(eventId);
    if (attendance.length === 0) return res.status(400).json({ error: 'No attendees found. Mark attendance first before generating certificates.' });

    // In parallel fetch all users
    const attendees = await Promise.all(attendance.map(a => getUserById(a.user_id)));
    const validAttendees = attendees.filter(Boolean);

    const { bulkGenerateCertificates } = require('../services/certificateService');
    const results = await bulkGenerateCertificates(validAttendees, event);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      data: { generated: successful, failed, total: results.length },
      message: `Generated ${successful} certificates`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate certificates', detail: err.message });
  }
});

// POST /api/certificates/:eventId/generate-one — generate for a single user
router.post('/:eventId/generate-one', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const user = await getUserById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { generateSingleCertificate } = require('../services/certificateService');
    const filePath = await generateSingleCertificate(user, event);

    const cert = await queryOne('SELECT * FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, user_id]);

    res.json({
      data: { certificate: cert, file_path: filePath },
      message: `Certificate generated for ${user.full_name}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate certificate', detail: err.message });
  }
});

// POST /api/certificates/:eventId/send — bulk email ALL
router.post('/:eventId/send', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const certs = await getEventCertificates(eventId);
    if (certs.length === 0) return res.status(400).json({ error: 'No certificates found. Generate certificates first.' });

    const { bulkSendCertificates } = require('../services/emailService');
    
    // Fetch users for certs
    const sendDataPromises = certs.map(async cert => {
      const user = await getUserById(cert.user_id);
      let certificatePath = cert.file_path;
      let pdfData = cert.pdf_data;
      let exists = !!pdfData || (certificatePath && fs.existsSync(certificatePath));

      if (!exists) {
        console.warn(`[CERT WARNING] File not found for student ${user?.full_name || cert.user_id}, auto-regenerating...`);
        const { generateSingleCertificate } = require('../services/certificateService');
        await generateSingleCertificate(user, event);
        const newCert = await queryOne('SELECT * FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, user.id]);
        if (newCert) {
          certificatePath = newCert.file_path;
          pdfData = newCert.pdf_data;
          exists = !!pdfData || (certificatePath && fs.existsSync(certificatePath));
        }
      }

      return {
        user,
        event,
        certificatePath,
        pdfData,
        exists
      };
    });
    
    let sendData = await Promise.all(sendDataPromises);
    sendData = sendData.filter(d => d.user && d.exists);

    if (sendData.length === 0) {
      console.error('[CERT ERROR] No valid certificate files found to send for event:', event.title);
      return res.status(400).json({ error: 'No valid certificate files found to send. Please regenerate them.' });
    }

    const results = await bulkSendCertificates(sendData);
    // There is no markCertificatesSent in new queries.js, so we do it here:
    await runSql('UPDATE certificates SET sent_via_email = 1 WHERE event_id = ?', [eventId]);

    const sent = results.filter(r => r.status === 'fulfilled').length;
    res.json({
      data: { sent, total: results.length },
      message: `Emailed ${sent} certificates`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send certificates', detail: err.message });
  }
});

// POST /api/certificates/:eventId/send-one — email certificate to a single user
router.post('/:eventId/send-one', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { user_id } = req.body;
    console.log(`[CERT SEND-ONE] Request: eventId=${eventId}, userId=${user_id}`);
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const user = await getUserById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let cert = await queryOne('SELECT * FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, user_id]);
    console.log(`[CERT SEND-ONE] Certificate record:`, cert ? { id: cert.id, file_path: cert.file_path, sent: cert.sent_via_email } : 'NOT FOUND');
    
    if (!cert) return res.status(400).json({ error: 'Certificate not generated yet. Generate it first.' });
    
    let certificatePath = cert.file_path;
    let pdfData = cert.pdf_data;
    let exists = !!pdfData || (certificatePath && fs.existsSync(certificatePath));

    if (!exists) {
      console.warn(`[CERT SEND-ONE] File missing on disk: ${cert.file_path}, auto-regenerating...`);
      const { generateSingleCertificate } = require('../services/certificateService');
      await generateSingleCertificate(user, event);
      const newCert = await queryOne('SELECT * FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, user_id]);
      if (newCert) {
        certificatePath = newCert.file_path;
        pdfData = newCert.pdf_data;
        exists = !!pdfData || (certificatePath && fs.existsSync(certificatePath));
      }
    }

    if (!exists) {
       return res.status(500).json({ error: 'Failed to auto-regenerate certificate.' });
    }

    console.log(`[CERT SEND-ONE] Sending to ${user.email}`);
    const { sendCertificate } = require('../services/emailService');
    const result = await sendCertificate(user, event, certificatePath, pdfData);
    console.log(`[CERT SEND-ONE] Result:`, result);

    if (result.success) {
      await runSql('UPDATE certificates SET sent_via_email = 1 WHERE id = ?', [cert.id]);
      res.json({ data: { sent: true }, message: `Certificate emailed to ${user.email}` });
    } else {
      res.status(500).json({ error: `Failed to email: ${result.error}` });
    }
  } catch (err) {
    console.error(`[CERT SEND-ONE] Exception:`, err);
    res.status(500).json({ error: 'Failed to send certificate', detail: err.message });
  }
});

// GET /api/certificates/:eventId/download/:userId — download PDF
router.get('/:eventId/download/:userId', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = parseInt(req.params.userId);

    let cert = await queryOne('SELECT * FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, userId]);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    // Students can only download if verified
    if (req.user.role === 'student' && cert.verification_status !== 'verified') {
      return res.status(403).json({ error: 'Please verify your name on the certificate before downloading.' });
    }

    // Auto-regenerate if neither pdf_data nor file on disk exists
    if (!cert.pdf_data && (!cert.file_path || !fs.existsSync(cert.file_path))) {
       const user = await getUserById(userId);
       const event = await getEventById(eventId);
       const { generateSingleCertificate } = require('../services/certificateService');
       await generateSingleCertificate(user, event);
       cert = await queryOne('SELECT * FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, userId]);
    }

    const user = await getUserById(userId);
    const safeName = user ? user.full_name.replace(/[^a-zA-Z0-9]/g, '_') : 'Certificate';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Certificate_${safeName}.pdf"`);

    if (cert.pdf_data) {
      return res.send(cert.pdf_data);
    } else {
      return res.sendFile(path.resolve(cert.file_path));
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to download certificate', detail: err.message });
  }
});

// PUT /api/certificates/:eventId/metadata — Admin edits cert title, speaker, name for an attendee
router.put('/:eventId/metadata', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { user_id, cert_title, speaker_name, speaker_title, cert_name_override } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const cert = await queryOne('SELECT id FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, user_id]);
    if (!cert) return res.status(404).json({ error: 'Certificate not generated yet.' });

    const fields = [];
    const params = [];
    if (cert_title !== undefined) { fields.push('cert_title = ?'); params.push(cert_title); }
    if (speaker_name !== undefined) { fields.push('speaker_name = ?'); params.push(speaker_name); }
    if (speaker_title !== undefined) { fields.push('speaker_title = ?'); params.push(speaker_title); }
    if (cert_name_override !== undefined) { fields.push('cert_name_override = ?'); params.push(cert_name_override); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Reset verification when admin changes metadata
    fields.push('verification_status = ?');
    params.push('pending');

    params.push(cert.id);
    await runSql(`UPDATE certificates SET ${fields.join(', ')} WHERE id = ?`, params);

    // Regenerate PDF with new metadata
    const user = await getUserById(user_id);
    const event = await getEventById(eventId);
    const updatedCert = await queryOne('SELECT * FROM certificates WHERE id = ?', [cert.id]);
    const { generateCertificateWithMeta } = require('../services/certificateService');
    await generateCertificateWithMeta(user, event, {
      cert_title: updatedCert.cert_title,
      speaker_name: updatedCert.speaker_name,
      speaker_title: updatedCert.speaker_title,
      cert_name_override: updatedCert.cert_name_override,
    });

    res.json({ message: 'Certificate metadata updated and PDF regenerated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update metadata', detail: err.message });
  }
});

// PUT /api/certificates/:eventId/verify-name — Student edits their own name and confirms
router.put('/:eventId/verify-name', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = req.user.id;
    const { cert_name_override } = req.body;

    const cert = await queryOne('SELECT id FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, userId]);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    const fields = ['verification_status = ?'];
    const params = ['verified'];

    if (cert_name_override && cert_name_override.trim()) {
      fields.push('cert_name_override = ?');
      params.push(cert_name_override.trim());
    }

    params.push(cert.id);
    await runSql(`UPDATE certificates SET ${fields.join(', ')} WHERE id = ?`, params);

    // Regenerate PDF with the verified name
    const user = await getUserById(userId);
    const event = await getEventById(eventId);
    const updatedCert = await queryOne('SELECT * FROM certificates WHERE id = ?', [cert.id]);
    const { generateCertificateWithMeta } = require('../services/certificateService');
    await generateCertificateWithMeta(user, event, {
      cert_title: updatedCert.cert_title,
      speaker_name: updatedCert.speaker_name,
      speaker_title: updatedCert.speaker_title,
      cert_name_override: updatedCert.cert_name_override || cert_name_override,
    });

    res.json({ message: 'Name verified and certificate updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify name', detail: err.message });
  }
});

module.exports = router;
