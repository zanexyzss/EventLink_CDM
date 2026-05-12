const nodemailer = require('nodemailer');
const { queryAll, queryOne, runSql } = require('../db/database');
require('dotenv').config();

function createTransporter() {
  // Using service: 'gmail' is more robust for Gmail SMTP than manual host/port
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function verifyTransporter() {
  const transporter = createTransporter();
  try {
    await transporter.verify();
    console.log('[EMAIL] SMTP Connection verified successfully');
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] SMTP Verification failed:', err.message);
    return false;
  }
}

async function sendEmail({ to, subject, html, attachments = [], type = 'general' }) {
  const transporter = createTransporter();
  try {
    // Gmail requires the 'from' address to be the authenticated user or an authorized alias
    const fromAddress = process.env.EMAIL_FROM || `EVENTLINK CDM <${process.env.EMAIL_USER}>`;
    
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      attachments
    });

    await runSql('INSERT INTO email_log (recipient_email, subject, type, status) VALUES (?,?,?,?)', [to, subject, type, 'sent']);
    console.log(`[EMAIL] Success: ${info.messageId} | Sent to ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    await runSql('INSERT INTO email_log (recipient_email, subject, type, status) VALUES (?,?,?,?)', [to, subject, type, 'failed']);
    console.error('[EMAIL ERROR]', err);
    return { success: false, error: err.message };
  }
}

async function sendEventAnnouncement(user, event) {
  return sendEmail({
    to: user.email,
    subject: `📢 New Event: ${event.title} — EVENTLINK CDM`,
    type: 'event_announcement',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:#1e3a8a;color:white;padding:24px;text-align:center">
          <h1 style="margin:0;font-size:24px">EVENTLINK CDM</h1>
          <p style="margin:4px 0 0;opacity:.8">New Event Announcement</p>
        </div>
        <div style="padding:32px">
          <h2 style="color:#1e3a8a;margin-top:0">${event.title}</h2>
          <p style="color:#64748b">Hello ${user.full_name},</p>
          <p>A new event has been published and is now open for registration!</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#64748b;width:40%">📅 Date</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${new Date(event.event_date).toLocaleString()}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#64748b">📍 Venue</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${event.venue || 'TBA'}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#64748b">🎫 Slots</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${event.max_slots || 'Unlimited'}</td></tr>
            <tr><td style="padding:8px;color:#64748b">⏰ Deadline</td><td style="padding:8px">${event.registration_deadline ? new Date(event.registration_deadline).toLocaleString() : 'Until full'}</td></tr>
          </table>
          ${event.description ? `<p style="color:#374151">${event.description}</p>` : ''}
          <p style="color:#64748b;font-size:14px">Log in to EVENTLINK CDM to register.</p>
        </div>
        <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:12px">EVENTLINK CDM — Campus Event Management</div>
      </div>`
  });
}

async function sendRegistrationConfirmation(user, event, qrCodePath) {
  const attachments = qrCodePath ? [{ filename: 'your-qr-code.png', path: qrCodePath, cid: 'qrcode' }] : [];
  return sendEmail({
    to: user.email, subject: `✅ Registration Confirmed: ${event.title}`,
    type: 'registration_confirmation', attachments,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:#16a34a;color:white;padding:24px;text-align:center"><h1 style="margin:0">Registration Confirmed! ✅</h1></div>
        <div style="padding:32px">
          <h2 style="color:#1e3a8a;margin-top:0">${event.title}</h2>
          <p>Hi ${user.full_name}, your registration is confirmed!</p>
          <p>Present the QR code below at the event for check-in:</p>
          ${qrCodePath ? '<div style="text-align:center;margin:20px 0"><img src="cid:qrcode" alt="QR Code" style="width:200px;height:200px"/></div>' : ''}
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#64748b;width:40%">📅 Date</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${new Date(event.event_date).toLocaleString()}</td></tr>
            <tr><td style="padding:8px;color:#64748b">📍 Venue</td><td style="padding:8px">${event.venue || 'TBA'}</td></tr>
          </table>
        </div>
      </div>`
  });
}

async function sendCertificate(user, event, certificatePath) {
  const safeName = user.full_name.replace(/ /g, '_');
  const fs = require('fs');
  const pathModule = require('path');
  
  // Resolve to absolute path
  const absolutePath = pathModule.resolve(certificatePath);
  console.log(`[CERT EMAIL] Attempting to send certificate to ${user.email}`);
  console.log(`[CERT EMAIL] File path: ${absolutePath}`);
  console.log(`[CERT EMAIL] File exists: ${fs.existsSync(absolutePath)}`);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`[CERT EMAIL] ERROR: Certificate PDF not found at ${absolutePath}`);
    return { success: false, error: `Certificate file not found: ${absolutePath}` };
  }
  
  const fileStats = fs.statSync(absolutePath);
  console.log(`[CERT EMAIL] File size: ${fileStats.size} bytes`);
  
  if (fileStats.size === 0) {
    console.error(`[CERT EMAIL] ERROR: Certificate PDF is empty (0 bytes)`);
    return { success: false, error: 'Certificate file is empty' };
  }

  return sendEmail({
    to: user.email, subject: `🏆 Your Certificate — ${event.title} | EVENTLINK CDM`, type: 'certificate',
    attachments: [{ filename: `Certificate_${safeName}.pdf`, path: absolutePath }],
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%);color:white;padding:40px 32px;text-align:center">
          <div style="font-size:14px;letter-spacing:3px;text-transform:uppercase;opacity:0.7;margin-bottom:8px">Colegio de Montalban</div>
          <h1 style="margin:0;font-size:28px;font-weight:700">🏆 Certificate of Participation</h1>
          <p style="margin:8px 0 0;opacity:0.7;font-size:14px">EVENTLINK CDM</p>
        </div>
        <div style="padding:40px 32px;text-align:center;background:#fff">
          <div style="width:60px;height:60px;background:linear-gradient(135deg,#d4af37,#f5e6a3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
            <span style="font-size:28px">🎉</span>
          </div>
          <h2 style="color:#1e1b4b;margin:0 0 8px;font-size:22px">Congratulations, ${user.full_name}!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px">
            Your certificate for <strong style="color:#4338ca">${event.title}</strong> is attached to this email as a PDF file.
          </p>
          <div style="background:#f8fafc;border-radius:8px;padding:20px;text-align:left;margin:0 0 24px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;width:100px">Event</td><td style="padding:6px 0;font-size:13px;font-weight:600;color:#1f2937">${event.title}</td></tr>
              <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px">Venue</td><td style="padding:6px 0;font-size:13px;color:#374151">${event.venue || 'Virtual'}</td></tr>
              <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px">Date</td><td style="padding:6px 0;font-size:13px;color:#374151">${new Date(String(event.event_date).replace(' ', 'T')).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</td></tr>
            </table>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin:0">Please keep this certificate for your records. If you have any questions, contact your event organizer.</p>
        </div>
        <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #f1f5f9">
          <p style="margin:0;color:#9ca3af;font-size:11px;letter-spacing:1px">EVENTLINK CDM — Campus Event Management System</p>
        </div>
      </div>`
  });
}

async function sendEventReminder(user, event) {
  return sendEmail({
    to: user.email, subject: `⏰ Reminder: ${event.title} is Tomorrow!`, type: 'event_reminder',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2 style="color:#1e3a8a">Event Reminder 📅</h2><p>Hi ${user.full_name}, <strong>${event.title}</strong> is tomorrow at <strong>${event.venue}</strong>.</p></div>`
  });
}

async function bulkSendAnnouncement(users, event) {
  return Promise.allSettled(users.map(u => sendEventAnnouncement(u, event)));
}

async function bulkSendCertificates(attendees) {
  console.log(`[EMAIL] Starting bulk certificate dispatch for ${attendees.length} attendees...`);
  const results = await Promise.allSettled(
    attendees.map(async ({ user, event, certificatePath }) => {
      try {
        const res = await sendCertificate(user, event, certificatePath);
        if (res.success) {
          console.log(`[EMAIL] Certificate successfully sent to ${user.email}`);
        } else {
          console.error(`[EMAIL ERROR] Failed to send to ${user.email}: ${res.error}`);
        }
        return res;
      } catch (err) {
        console.error(`[EMAIL ERROR] Critical failure sending to ${user.email}:`, err);
        throw err;
      }
    })
  );
  return results;
}

module.exports = { 
  verifyTransporter,
  sendEmail, 
  sendEventAnnouncement, 
  sendRegistrationConfirmation, 
  sendCertificate, 
  sendEventReminder, 
  bulkSendAnnouncement, 
  bulkSendCertificates 
};
