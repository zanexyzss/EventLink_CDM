/**
 * EmailService — Handles all transactional email sending via Brevo API.
 * 
 * OOP: Extends BaseService (INHERITANCE), private API config (ENCAPSULATION),
 * overrides initialize() (POLYMORPHISM), hides HTTP/template complexity (ABSTRACTION).
 */
const fs = require('fs');
const path = require('path');
const BaseService = require('./BaseService');
const { runSql } = require('../db/database');
require('dotenv').config();

class EmailService extends BaseService {
  #apiKey;
  #senderEmail;
  #senderName;
  #frontendUrl;

  constructor() {
    super('EMAIL');
    this.#apiKey = process.env.BREVO_API_KEY;
    this.#senderEmail = process.env.EMAIL_FROM || 'zannesioson@gmail.com';
    this.#senderName = process.env.APP_NAME || 'EVENTLINK CDM';
    this.#frontendUrl = process.env.FRONTEND_URL || 'https://event-link-cdm.vercel.app';
  }

  /** @override — Polymorphic: validates Brevo API key */
  async initialize() {
    await super.initialize();
    if (!this.#apiKey) {
      this.logError('BREVO_API_KEY not set — email sending disabled');
      return false;
    }
    this.log('Brevo API configured successfully');
    return true;
  }

  // ─── Private: Parse sender info (Encapsulation) ─────────────
  #parseSender() {
    let email = this.#senderEmail;
    let name = this.#senderName;
    const match = this.#senderEmail.match(/^(.*?)<([^>]+)>$/);
    if (match) { name = match[1].trim() || this.#senderName; email = match[2].trim(); }
    return { email, name };
  }

  // ─── Private: Process attachments (Encapsulation) ───────────
  #processAttachments(attachments) {
    return attachments.map(att => {
      if (att.content && Buffer.isBuffer(att.content)) {
        return { name: att.filename, content: att.content.toString('base64') };
      }
      if (att.content && typeof att.content === 'string') {
        return { name: att.filename, content: att.content.startsWith('JVBER') ? att.content : Buffer.from(att.content).toString('base64') };
      }
      if (att.path) {
        const absPath = path.resolve(att.path);
        if (fs.existsSync(absPath)) {
          return { name: att.filename, content: fs.readFileSync(absPath).toString('base64') };
        }
      }
      return null;
    }).filter(Boolean);
  }

  // ─── Private: Log to database (Encapsulation) ──────────────
  async #logToDb(to, subject, type, status) {
    try {
      await runSql('INSERT INTO email_log (recipient_email, subject, type, status) VALUES (?,?,?,?)', [
        Array.isArray(to) ? to.join(', ') : to, subject, type, status
      ]);
    } catch {}
  }

  // ─── Private: HTML template builders (Abstraction) ──────────
  #headerTemplate(bgGradient, title, subtitle = '') {
    return `<div style="background:linear-gradient(135deg,${bgGradient});color:white;padding:32px;text-align:center">
      ${subtitle ? `<div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.7;margin-bottom:4px">${subtitle}</div>` : ''}
      <h1 style="margin:0;font-size:24px;font-weight:700">${title}</h1>
    </div>`;
  }

  #footerTemplate() {
    return `<div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:11px;letter-spacing:1px">EVENTLINK CDM — Campus Event Management</div>`;
  }

  #wrapEmail(content) {
    return `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">${content}</div>`;
  }

  // ─── Public API ─────────────────────────────────────────────

  async sendEmail({ to, subject, html, attachments = [], type = 'general' }) {
    try {
      if (!this.#apiKey) throw new Error('BREVO_API_KEY is not set');
      const sender = this.#parseSender();
      const brevoAttachments = this.#processAttachments(attachments);

      const payload = {
        sender: { name: sender.name, email: sender.email },
        to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
        bcc: [{ email: sender.email }],
        subject, htmlContent: html
      };
      if (brevoAttachments.length > 0) payload.attachment = brevoAttachments;

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': this.#apiKey, 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Brevo API Error: ${response.status}`);

      await this.#logToDb(to, subject, type, 'sent');
      this.log(`Success: ${data.messageId || 'sent'} | Sent to ${to}`);
      return { success: true, messageId: data.messageId };
    } catch (err) {
      await this.#logToDb(to, subject, type, 'failed');
      this.logError(err.message);
      return { success: false, error: err.message };
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${this.#frontendUrl}/reset-password?token=${resetToken}`;
    return this.sendEmail({
      to: user.email, subject: `🔒 Password Reset Request — EVENTLINK CDM`, type: 'password_reset',
      html: this.#wrapEmail(
        this.#headerTemplate('#1e3a8a 0%,#1e40af 100%', 'Password Reset Request') +
        `<div style="padding:32px">
          <p style="color:#374151;font-size:15px">Hello <strong>${user.full_name}</strong>,</p>
          <p style="color:#374151;font-size:15px">We received a request to reset your password. This link expires in 1 hour.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px">Reset My Password</a>
          </div>
          <p style="color:#64748b;font-size:13px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
        </div>` + this.#footerTemplate()
      )
    });
  }

  async sendEventAnnouncement(user, event) {
    const ed = new Date(String(event.event_date).replace(' ', 'T'));
    const dateStr = ed.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    const dlStr = event.registration_deadline ? new Date(String(event.registration_deadline).replace(' ', 'T')).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : 'Until full';
    return this.sendEmail({
      to: user.email, subject: `📢 New Event: ${event.title} — EVENTLINK CDM`, type: 'event_announcement',
      html: this.#wrapEmail(
        this.#headerTemplate('#1e3a8a 0%,#1e40af 100%', '📢 New Event Announcement', 'EVENTLINK CDM') +
        `<div style="padding:32px">
          <h2 style="color:#1e3a8a;margin-top:0;font-size:20px">${event.title}</h2>
          <p style="color:#64748b;font-size:15px">Hello <strong>${user.full_name}</strong>,</p>
          <p style="color:#374151;font-size:15px">A new event has been published!</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;width:40%;font-size:14px">📅 Date</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1f2937">${dateStr}</td></tr>
            <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">📍 Venue</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1f2937">${event.venue || 'TBA'}</td></tr>
            <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px">🎫 Slots</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1f2937">${event.max_slots || 'Unlimited'}</td></tr>
            <tr><td style="padding:10px 12px;color:#64748b;font-size:14px">⏰ Deadline</td><td style="padding:10px 12px;font-size:14px;color:#1f2937">${dlStr}</td></tr>
          </table>
          ${event.description ? `<p style="color:#374151;font-size:14px;line-height:1.6">${event.description}</p>` : ''}
          <div style="text-align:center;margin:28px 0 8px"><a href="${this.#frontendUrl}/events" style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px">View Event Details</a></div>
        </div>` + this.#footerTemplate()
      )
    });
  }

  async sendRegistrationConfirmation(user, event, qrCodePath) {
    const attachments = [];
    if (qrCodePath) {
      const absPath = path.resolve(qrCodePath);
      if (fs.existsSync(absPath)) {
        attachments.push({ filename: 'your-qr-code.png', content: fs.readFileSync(absPath) });
      }
    }
    const ed = new Date(String(event.event_date).replace(' ', 'T'));
    const dateStr = ed.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    return this.sendEmail({
      to: user.email, subject: `✅ Registration Confirmed: ${event.title}`, type: 'registration_confirmation', attachments,
      html: this.#wrapEmail(
        this.#headerTemplate('#16a34a 0%,#15803d 100%', 'Registration Confirmed! ✅') +
        `<div style="padding:32px">
          <h2 style="color:#1e3a8a;margin-top:0;font-size:20px">${event.title}</h2>
          <p style="color:#374151;font-size:15px">Hi <strong>${user.full_name}</strong>, your registration is confirmed!</p>
          <p style="color:#64748b;font-size:14px">Present your QR code at the event for check-in.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;width:40%;font-size:14px">📅 Date</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1f2937">${dateStr}</td></tr>
            <tr><td style="padding:10px 12px;color:#64748b;font-size:14px">📍 Venue</td><td style="padding:10px 12px;font-size:14px;color:#1f2937">${event.venue || 'TBA'}</td></tr>
          </table>
        </div>` + this.#footerTemplate()
      )
    });
  }

  async sendCertificate(user, event, certificatePath, pdfData = null) {
    const verifyUrl = `${this.#frontendUrl}/my-certificates?verify=${event.id}`;
    const ed = new Date(String(event.event_date).replace(' ', 'T'));
    const dateStr = ed.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    return this.sendEmail({
      to: user.email, subject: `🏆 Your Certificate — ${event.title} | EVENTLINK CDM`, type: 'certificate',
      html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%);color:white;padding:44px 32px;text-align:center">
          <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:0.6;margin-bottom:6px">Colegio de Montalban</div>
          <h1 style="margin:0;font-size:26px;font-weight:700">🏆 Certificate of Participation</h1>
          <p style="margin:8px 0 0;opacity:0.6;font-size:13px;letter-spacing:1px">EVENTLINK CDM</p>
        </div>
        <div style="padding:40px 32px;text-align:center;background:#fff">
          <h2 style="color:#1e1b4b;margin:0 0 8px;font-size:22px">Congratulations, ${user.full_name}!</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 8px">Your certificate for <strong style="color:#4338ca">${event.title}</strong> has been generated.</p>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 28px">Please verify that the name on your certificate is correct.</p>
          <div style="margin:0 0 32px"><a href="${verifyUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:white;text-decoration:none;padding:16px 48px;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(22,163,74,0.3)">✅ Verify Your Name</a></div>
          <div style="background:#f8fafc;border-radius:10px;padding:20px;text-align:left;margin:0 0 20px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;width:90px">Event</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#1f2937">${event.title}</td></tr>
              <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">Venue</td><td style="padding:8px 0;font-size:13px;color:#374151">${event.venue || 'Virtual'}</td></tr>
              <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">Date</td><td style="padding:8px 0;font-size:13px;color:#374151">${dateStr}</td></tr>
            </table>
          </div>
          <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.5">After verifying, download your certificate from the system.</p>
        </div>
        <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #f1f5f9"><p style="margin:0;color:#9ca3af;font-size:11px;letter-spacing:1px">EVENTLINK CDM — Campus Event Management System</p></div>
      </div>`
    });
  }

  async sendEventReminder(user, event) {
    return this.sendEmail({
      to: user.email, subject: `⏰ Reminder: ${event.title} is Tomorrow!`, type: 'event_reminder',
      html: this.#wrapEmail(
        this.#headerTemplate('#f59e0b,#d97706', '⏰ Event Reminder') +
        `<div style="padding:32px">
          <p style="color:#374151;font-size:15px">Hi <strong>${user.full_name}</strong>,</p>
          <p style="color:#374151;font-size:15px"><strong style="color:#1e3a8a">${event.title}</strong> is tomorrow at <strong>${event.venue || 'TBA'}</strong>.</p>
          <p style="color:#64748b;font-size:14px">Don't forget your QR code for check-in!</p>
          <div style="text-align:center;margin:24px 0 8px"><a href="${this.#frontendUrl}/events" style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px">Open EventLink</a></div>
        </div>` + this.#footerTemplate()
      )
    });
  }

  async bulkSendAnnouncement(users, event) {
    return Promise.allSettled(users.map(u => this.sendEventAnnouncement(u, event)));
  }

  async bulkSendCertificates(attendees) {
    this.log(`Starting bulk certificate dispatch for ${attendees.length} attendees...`);
    return Promise.allSettled(
      attendees.map(async ({ user, event, certificatePath, pdfData }) => {
        try {
          const res = await this.sendCertificate(user, event, certificatePath, pdfData);
          if (res.success) this.log(`Certificate notification sent to ${user.email}`);
          else this.logError(`Failed to send to ${user.email}: ${res.error}`);
          return res;
        } catch (err) {
          this.logError(`Critical failure sending to ${user.email}:`, err);
          throw err;
        }
      })
    );
  }
}

// Singleton & backward-compatible exports
const instance = new EmailService();

module.exports = {
  verifyTransporter: () => instance.initialize(),
  sendEmail: (opts) => instance.sendEmail(opts),
  sendEventAnnouncement: (u, e) => instance.sendEventAnnouncement(u, e),
  sendRegistrationConfirmation: (u, e, q) => instance.sendRegistrationConfirmation(u, e, q),
  sendCertificate: (u, e, p, d) => instance.sendCertificate(u, e, p, d),
  sendEventReminder: (u, e) => instance.sendEventReminder(u, e),
  bulkSendAnnouncement: (u, e) => instance.bulkSendAnnouncement(u, e),
  bulkSendCertificates: (a) => instance.bulkSendCertificates(a),
  sendPasswordResetEmail: (u, t) => instance.sendPasswordResetEmail(u, t),
  EmailService
};
