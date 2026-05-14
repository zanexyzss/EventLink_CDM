const fs = require('fs');
const path = require('path');
const { runSql } = require('../db/database');
require('dotenv').config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://event-link-cdm.vercel.app';

async function verifyTransporter() {
  if (!process.env.BREVO_API_KEY) {
    console.error('[EMAIL] BREVO_API_KEY not set — email sending disabled');
    return false;
  }
  console.log('[EMAIL] Brevo API configured successfully');
  return true;
}

async function sendEmail({ to, subject, html, attachments = [], type = 'general' }) {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error('BREVO_API_KEY is not set');

    const senderEmail = process.env.EMAIL_FROM || 'zannesioson@gmail.com';
    const senderName = process.env.APP_NAME || 'EVENTLINK CDM';

    // Extract email from formats like "Name <email@domain.com>" if needed, or just pass it to Brevo.
    // Brevo requires `{ email, name }`.
    let sEmail = senderEmail;
    let sName = senderName;
    const match = senderEmail.match(/^(.*?)<([^>]+)>$/);
    if (match) {
      sName = match[1].trim() || senderName;
      sEmail = match[2].trim();
    }

    const brevoAttachments = attachments.map(att => {
      if (att.content && Buffer.isBuffer(att.content)) {
        return { name: att.filename, content: att.content.toString('base64') };
      }
      if (att.content && typeof att.content === 'string') {
        // If it's already a base64 string or plain string
        return { name: att.filename, content: att.content.startsWith('JVBER') ? att.content : Buffer.from(att.content).toString('base64') };
      }
      if (att.path) {
        const absolutePath = path.resolve(att.path);
        if (fs.existsSync(absolutePath)) {
          return { name: att.filename, content: fs.readFileSync(absolutePath).toString('base64') };
        }
      }
      return null;
    }).filter(Boolean);

    const payload = {
      sender: { name: sName, email: sEmail },
      to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
      bcc: [{ email: sEmail }], // Send a copy to the system admin
      subject: subject,
      htmlContent: html
    };

    if (brevoAttachments.length > 0) {
      payload.attachment = brevoAttachments;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Brevo API Error: ${response.status}`);
    }

    await runSql('INSERT INTO email_log (recipient_email, subject, type, status) VALUES (?,?,?,?)', [
      Array.isArray(to) ? to.join(', ') : to, subject, type, 'sent'
    ]);

    console.log(`[EMAIL] Success: ${data.messageId || 'sent'} | Sent to ${to}`);
    return { success: true, messageId: data.messageId };
  } catch (err) {
    await runSql('INSERT INTO email_log (recipient_email, subject, type, status) VALUES (?,?,?,?)', [
      Array.isArray(to) ? to.join(', ') : to, subject, type, 'failed'
    ]).catch(() => {});

    console.error('[EMAIL ERROR]', err);
    return { success: false, error: err.message };
  }
}

async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: user.email,
    subject: `🔒 Password Reset Request — EVENTLINK CDM`,
    type: 'password_reset',
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);color:white;padding:32px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:700">Password Reset Request</h1>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:15px">Hello <strong>${user.full_name}</strong>,</p>
          <p style="color:#374151;font-size:15px">We received a request to reset your password for your EVENTLINK CDM account. This link will expire in 1 hour.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px">Reset My Password</a>
          </div>
          <p style="color:#64748b;font-size:13px;margin-top:24px">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
        <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:11px;letter-spacing:1px">EVENTLINK CDM — Campus Event Management</div>
      </div>`
  });
}

async function sendEventAnnouncement(user, event) {
  return sendEmail({
    to: user.email,
    subject: `📢 New Event: ${event.title} — EVENTLINK CDM`,
    type: 'event_announcement',
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);color:white;padding:32px;text-align:center">
          <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.7;margin-bottom:4px">EVENTLINK CDM</div>
          <h1 style="margin:0;font-size:24px;font-weight:700">📢 New Event Announcement</h1>
        </div>
        <div style="padding:32px">
          <h2 style="color:#1e3a8a;margin-top:0;font-size:20px">${event.title}</h2>
          <p style="color:#64748b;font-size:15px">Hello <strong>${user.full_name}</strong>,</p>
          <p style="color:#374151;font-size:15px">A new event has been published and is now open for registration!</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;width:40%;font-size:14px">📅 Date</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1f2937">${new Date(String(event.event_date).replace(' ', 'T')).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</td></tr>
            <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">📍 Venue</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1f2937">${event.venue || 'TBA'}</td></tr>
            <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">🎫 Slots</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1f2937">${event.max_slots || 'Unlimited'}</td></tr>
            <tr><td style="padding:10px 12px;color:#64748b;font-size:14px">⏰ Deadline</td><td style="padding:10px 12px;font-size:14px;color:#1f2937">${event.registration_deadline ? new Date(String(event.registration_deadline).replace(' ', 'T')).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : 'Until full'}</td></tr>
          </table>
          ${event.description ? `<p style="color:#374151;font-size:14px;line-height:1.6">${event.description}</p>` : ''}
          <div style="text-align:center;margin:28px 0 8px">
            <a href="${FRONTEND_URL}/events" style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px">View Event Details</a>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:11px;letter-spacing:1px">EVENTLINK CDM — Campus Event Management</div>
      </div>`
  });
}

async function sendRegistrationConfirmation(user, event, qrCodePath) {
  const attachments = [];
  if (qrCodePath) {
    const absPath = path.resolve(qrCodePath);
    if (fs.existsSync(absPath)) {
      attachments.push({ filename: 'your-qr-code.png', content: fs.readFileSync(absPath) });
    }
  }

  return sendEmail({
    to: user.email,
    subject: `✅ Registration Confirmed: ${event.title}`,
    type: 'registration_confirmation',
    attachments,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);color:white;padding:32px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:700">Registration Confirmed! ✅</h1>
        </div>
        <div style="padding:32px">
          <h2 style="color:#1e3a8a;margin-top:0;font-size:20px">${event.title}</h2>
          <p style="color:#374151;font-size:15px">Hi <strong>${user.full_name}</strong>, your registration is confirmed!</p>
          <p style="color:#64748b;font-size:14px">Present your QR code at the event for check-in.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;width:40%;font-size:14px">📅 Date</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1f2937">${new Date(String(event.event_date).replace(' ', 'T')).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</td></tr>
            <tr><td style="padding:10px 12px;color:#64748b;font-size:14px">📍 Venue</td><td style="padding:10px 12px;font-size:14px;color:#1f2937">${event.venue || 'TBA'}</td></tr>
          </table>
        </div>
        <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:11px;letter-spacing:1px">EVENTLINK CDM — Campus Event Management</div>
      </div>`
  });
}

async function sendCertificate(user, event, certificatePath, pdfData = null) {
  const eventId = event.id;
  const verifyUrl = `${FRONTEND_URL}/my-certificates?verify=${eventId}`;

  return sendEmail({
    to: user.email,
    subject: `🏆 Your Certificate — ${event.title} | EVENTLINK CDM`,
    type: 'certificate',
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%);color:white;padding:44px 32px;text-align:center">
          <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.6;margin-bottom:6px">Colegio de Montalban</div>
          <h1 style="margin:0;font-size:26px;font-weight:700">🏆 Certificate of Participation</h1>
          <p style="margin:8px 0 0;opacity:0.6;font-size:13px;letter-spacing:1px">EVENTLINK CDM</p>
        </div>
        <div style="padding:40px 32px;text-align:center;background:#fff">
          <h2 style="color:#1e1b4b;margin:0 0 8px;font-size:22px">Congratulations, ${user.full_name}!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 8px">
            Your certificate for <strong style="color:#4338ca">${event.title}</strong> has been generated and is ready.
          </p>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 28px">
            Before downloading, please verify that the name on your certificate is correct.
          </p>

          <!-- Verify Button -->
          <div style="margin:0 0 32px">
            <a href="${verifyUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:white;text-decoration:none;padding:16px 48px;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(22,163,74,0.3)">✅ Verify Your Name</a>
          </div>

          <div style="background:#f8fafc;border-radius:10px;padding:20px;text-align:left;margin:0 0 20px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;width:90px">Event</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#1f2937">${event.title}</td></tr>
              <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">Venue</td><td style="padding:8px 0;font-size:13px;color:#374151">${event.venue || 'Virtual'}</td></tr>
              <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">Date</td><td style="padding:8px 0;font-size:13px;color:#374151">${new Date(String(event.event_date).replace(' ', 'T')).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</td></tr>
            </table>
          </div>

          <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.5">
            After verifying your name, you can download the certificate directly from the EVENTLINK CDM system.
          </p>
        </div>
        <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #f1f5f9">
          <p style="margin:0;color:#9ca3af;font-size:11px;letter-spacing:1px">EVENTLINK CDM — Campus Event Management System</p>
        </div>
      </div>`
  });
}

async function sendEventReminder(user, event) {
  return sendEmail({
    to: user.email,
    subject: `⏰ Reminder: ${event.title} is Tomorrow!`,
    type: 'event_reminder',
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:32px;text-align:center">
          <h1 style="margin:0;font-size:24px;font-weight:700">⏰ Event Reminder</h1>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:15px">Hi <strong>${user.full_name}</strong>,</p>
          <p style="color:#374151;font-size:15px"><strong style="color:#1e3a8a">${event.title}</strong> is tomorrow at <strong>${event.venue || 'TBA'}</strong>.</p>
          <p style="color:#64748b;font-size:14px">Don't forget to bring your QR code for check-in!</p>
          <div style="text-align:center;margin:24px 0 8px">
            <a href="${FRONTEND_URL}/events" style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px">Open EventLink</a>
          </div>
        </div>
        <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:11px;letter-spacing:1px">EVENTLINK CDM — Campus Event Management</div>
      </div>`
  });
}

async function bulkSendAnnouncement(users, event) {
  return Promise.allSettled(users.map(u => sendEventAnnouncement(u, event)));
}

async function bulkSendCertificates(attendees) {
  console.log(`[EMAIL] Starting bulk certificate dispatch for ${attendees.length} attendees...`);
  const results = await Promise.allSettled(
    attendees.map(async ({ user, event, certificatePath, pdfData }) => {
      try {
        const res = await sendCertificate(user, event, certificatePath, pdfData);
        if (res.success) {
          console.log(`[EMAIL] Certificate notification sent to ${user.email}`);
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
  bulkSendCertificates,
  sendPasswordResetEmail
};
