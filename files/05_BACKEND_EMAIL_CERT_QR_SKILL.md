---
name: backend
agent: BACKEND_AGENT
role: All Express API routes + business logic
runs: STEP 4 (parallel with EMAIL, CERTIFICATE, QR agents)
depends_on: AUTH_AGENT, DATABASE_AGENT
---

# BACKEND AGENT — EVENTLINK CDM

You write all Express API routes. Every route must: authenticate the request, validate input, call DB queries, and return proper HTTP status + JSON.

## EXPRESS APP SETUP — `electron/server/app.js`

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../../assets/uploads")),
);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/events", require("./routes/events"));
app.use("/api/registrations", require("./routes/registrations"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/certificates", require("./routes/certificates"));
app.use("/api/users", require("./routes/users"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/settings", require("./routes/settings"));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`EVENTLINK API running on port ${PORT}`));

module.exports = app;
```

## ROUTE REQUIREMENTS

### `routes/events.js` — must implement:

- `GET /api/events` — list all open events (student) or all (admin/organizer), support `?status=`, `?search=`, `?type=` filters
- `POST /api/events` — create event; auto-generate `event_code` = `EVT-${Date.now()}`; requires organizer+
- `GET /api/events/:id` — single event with registration count
- `PUT /api/events/:id` — update; organizer can only update own events
- `POST /api/events/:id/open` — set status to 'open', trigger announcement email
- `POST /api/events/:id/close` — set status to 'closed'
- `POST /api/events/:id/complete` — set status to 'completed'

### `routes/registrations.js` — must implement:

- `GET /api/events/:id/registrations` — list registrants (organizer+)
- `POST /api/events/:id/register` — register current user; check: slots available, deadline not passed, not already registered, event is 'open'
- `DELETE /api/events/:id/register` — cancel own registration
- `GET /api/registrations/mine` — current user's registrations

### `routes/attendance.js` — must implement:

- `GET /api/events/:id/attendance` — list (organizer+)
- `POST /api/events/:id/attendance` — mark present `{user_id, method}` (organizer+)
- `GET /api/events/:id/attendance/:userId` — check if user attended

### `routes/users.js` — admin only:

- `GET /api/users` — all users (paginated, `?role=`, `?search=`)
- `GET /api/users/:id`
- `PUT /api/users/:id` — update role, department, year_level
- `DELETE /api/users/:id` — cannot delete self or the last admin

### `routes/reports.js`:

- `GET /api/reports/events/:id` — {event, registrations_count, attendance_count, attendance_rate, certificates_sent}
- `GET /api/reports/overall` — {total_events, total_registrations, total_students, top_events[]}
- `GET /api/reports/export/:id` — returns CSV of registrants + attendance status

### `routes/settings.js`:

- `GET /api/settings` — all settings (admin)
- `PUT /api/settings` — update settings `{key, value}` pairs (admin)

## RESPONSE FORMAT STANDARD

```javascript
// Success
res.json({ data: {...}, message: 'Success' })          // single item
res.json({ data: [...], total: N, message: 'OK' })     // list

// Created
res.status(201).json({ data: {...}, message: 'Created' })

// Error
res.status(400).json({ error: 'Validation message' })  // bad input
res.status(401).json({ error: 'Unauthorized' })
res.status(403).json({ error: 'Forbidden' })
res.status(404).json({ error: 'Not found' })
res.status(409).json({ error: 'Conflict message' })
```

## RULES

- Every route that mutates data → wrap in try/catch
- Use `authenticateToken` on all routes except `/api/auth/*`
- Use `requireAdmin`/`requireOrganizer` as second middleware where needed
- Never expose `password_hash` in any response
- Paginate list endpoints: default `limit=20, offset=0`

## VALIDATION CHECKLIST

- [ ] All 8 route files created
- [ ] All endpoints in canonical API contract implemented
- [ ] Role guards applied correctly
- [ ] Error responses use standard format
- [ ] No route crashes the server (all try/catch)

---

---

# EMAIL AGENT — EVENTLINK CDM

---

name: email
agent: EMAIL_AGENT
role: Nodemailer setup + all email templates + send functions
runs: STEP 5 (parallel with BACKEND, CERTIFICATE, QR)

---

## `electron/server/services/emailService.js`

```javascript
const nodemailer = require("nodemailer");
const { getSetting, getDb } = require("../db/database");
require("dotenv").config();

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendEmail({
  to,
  subject,
  html,
  attachments = [],
  type = "general",
}) {
  const db = getDb();
  const transporter = createTransporter();
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "EVENTLINK CDM <no-reply@eventlink.cdm>",
      to,
      subject,
      html,
      attachments,
    });
    db.prepare(
      "INSERT INTO email_log (recipient_email, subject, type, status) VALUES (?,?,?,?)",
    ).run(to, subject, type, "sent");
    return { success: true };
  } catch (err) {
    db.prepare(
      "INSERT INTO email_log (recipient_email, subject, type, status) VALUES (?,?,?,?)",
    ).run(to, subject, type, "failed");
    console.error("[EMAIL ERROR]", err.message);
    return { success: false, error: err.message };
  }
}

// TEMPLATE: Event Announcement
async function sendEventAnnouncement(user, event) {
  return sendEmail({
    to: user.email,
    subject: `📢 New Event: ${event.title} — EVENTLINK CDM`,
    type: "event_announcement",
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
            <tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#64748b">📍 Venue</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${event.venue || "TBA"}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#64748b">🎫 Slots</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${event.max_slots || "Unlimited"}</td></tr>
            <tr><td style="padding:8px;color:#64748b">⏰ Deadline</td><td style="padding:8px">${event.registration_deadline ? new Date(event.registration_deadline).toLocaleString() : "Until full"}</td></tr>
          </table>
          ${event.description ? `<p style="color:#374151">${event.description}</p>` : ""}
          <p style="color:#64748b;font-size:14px">Log in to EVENTLINK CDM to register for this event.</p>
        </div>
        <div style="background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:12px">
          EVENTLINK CDM — Campus Event Management System
        </div>
      </div>
    `,
  });
}

// TEMPLATE: Registration Confirmation
async function sendRegistrationConfirmation(user, event, qrCodePath) {
  const attachments = qrCodePath
    ? [{ filename: "your-qr-code.png", path: qrCodePath, cid: "qrcode" }]
    : [];
  return sendEmail({
    to: user.email,
    subject: `✅ Registration Confirmed: ${event.title}`,
    type: "registration_confirmation",
    attachments,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:#16a34a;color:white;padding:24px;text-align:center">
          <h1 style="margin:0">Registration Confirmed! ✅</h1>
        </div>
        <div style="padding:32px">
          <h2 style="color:#1e3a8a;margin-top:0">${event.title}</h2>
          <p>Hi ${user.full_name}, your registration is confirmed!</p>
          <p>Present the QR code below at the event for check-in:</p>
          ${qrCodePath ? '<div style="text-align:center;margin:20px 0"><img src="cid:qrcode" alt="QR Code" style="width:200px;height:200px"/></div>' : ""}
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #f1f5f9;color:#64748b;width:40%">📅 Date</td><td style="padding:8px;border-bottom:1px solid #f1f5f9">${new Date(event.event_date).toLocaleString()}</td></tr>
            <tr><td style="padding:8px;color:#64748b">📍 Venue</td><td style="padding:8px">${event.venue || "TBA"}</td></tr>
          </table>
          <p style="color:#64748b;font-size:14px">Save this email. You'll need the QR code to check in.</p>
        </div>
      </div>
    `,
  });
}

// TEMPLATE: Certificate Email
async function sendCertificate(user, event, certificatePath) {
  return sendEmail({
    to: user.email,
    subject: `🏆 Certificate of Participation — ${event.title}`,
    type: "certificate",
    attachments: [
      {
        filename: `Certificate_${user.full_name.replace(/ /g, "_")}.pdf`,
        path: certificatePath,
      },
    ],
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:#7c3aed;color:white;padding:24px;text-align:center">
          <h1 style="margin:0">🏆 Certificate of Participation</h1>
        </div>
        <div style="padding:32px;text-align:center">
          <p style="font-size:18px">Congratulations, <strong>${user.full_name}</strong>!</p>
          <p>Thank you for participating in <strong>${event.title}</strong>.</p>
          <p>Please find your Certificate of Participation attached to this email.</p>
        </div>
      </div>
    `,
  });
}

// TEMPLATE: Event Reminder
async function sendEventReminder(user, event) {
  return sendEmail({
    to: user.email,
    subject: `⏰ Reminder: ${event.title} is Tomorrow!`,
    type: "event_reminder",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#1e3a8a">Event Reminder 📅</h2>
        <p>Hi ${user.full_name}, don't forget!</p>
        <p><strong>${event.title}</strong> is happening tomorrow at <strong>${event.venue}</strong>.</p>
        <p>Make sure to bring your QR code for check-in.</p>
      </div>
    `,
  });
}

// BULK SEND HELPERS
async function bulkSendAnnouncement(users, event) {
  return Promise.allSettled(users.map((u) => sendEventAnnouncement(u, event)));
}

async function bulkSendCertificates(attendees) {
  return Promise.allSettled(
    attendees.map(({ user, event, certificatePath }) =>
      sendCertificate(user, event, certificatePath),
    ),
  );
}

module.exports = {
  sendEmail,
  sendEventAnnouncement,
  sendRegistrationConfirmation,
  sendCertificate,
  sendEventReminder,
  bulkSendAnnouncement,
  bulkSendCertificates,
};
```

---

---

# CERTIFICATE AGENT — EVENTLINK CDM

---

name: certificate
agent: CERTIFICATE_AGENT
role: PDF certificate generation using Puppeteer
runs: STEP 6 (parallel)

---

## `electron/server/services/certificateService.js`

```javascript
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const { getDb } = require("../db/database");

const CERT_DIR = path.join(__dirname, "../../../assets/certificates");
if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

function getCertificateHTML(user, event) {
  const eventDate = new Date(event.event_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 1122px; height: 794px; display: flex; align-items: center; justify-content: center; background: #fff; }
        .cert {
          width: 100%; height: 100%;
          border: 20px solid #1e3a8a;
          outline: 4px solid #c7a84e;
          outline-offset: -28px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 60px; text-align: center; position: relative;
          background: linear-gradient(135deg, #fffff8 0%, #f0f4ff 100%);
        }
        .header { font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 6px; color: #c7a84e; text-transform: uppercase; margin-bottom: 16px; }
        .title { font-family: 'Cinzel', serif; font-size: 48px; color: #1e3a8a; margin-bottom: 24px; font-weight: 700; }
        .presented { font-family: 'Inter', sans-serif; font-size: 14px; color: #64748b; letter-spacing: 2px; margin-bottom: 12px; }
        .name { font-family: 'Cinzel', serif; font-size: 36px; color: #1e3a8a; border-bottom: 2px solid #c7a84e; padding-bottom: 8px; margin-bottom: 24px; }
        .body { font-family: 'Inter', sans-serif; font-size: 16px; color: #374151; line-height: 1.8; max-width: 600px; }
        .event-name { font-weight: 600; color: #1e3a8a; }
        .footer { position: absolute; bottom: 60px; display: flex; justify-content: space-between; width: calc(100% - 120px); }
        .sig-line { text-align: center; }
        .sig-line div { width: 200px; border-top: 1px solid #374151; padding-top: 8px; font-family: 'Inter', sans-serif; font-size: 12px; color: #64748b; }
        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-family: 'Cinzel', serif; font-size: 80px; color: rgba(30,58,138,0.04); white-space: nowrap; pointer-events: none; }
      </style>
    </head>
    <body>
      <div class="cert">
        <div class="watermark">EVENTLINK CDM</div>
        <div class="header">Certificate of Participation</div>
        <div class="title">EVENTLINK CDM</div>
        <div class="presented">This certificate is proudly presented to</div>
        <div class="name">${user.full_name}</div>
        <div class="body">
          for successfully participating in<br>
          <span class="event-name">${event.title}</span><br>
          held on ${eventDate} at ${event.venue || "the designated venue"}.
        </div>
        <div class="footer">
          <div class="sig-line"><div>Event Organizer</div></div>
          <div style="text-align:center;font-family:Inter,sans-serif;font-size:12px;color:#94a3b8">
            EVENTLINK CDM<br>${eventDate}
          </div>
          <div class="sig-line"><div>Admin</div></div>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function generateCertificate(user, event) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(getCertificateHTML(user, event), {
    waitUntil: "networkidle0",
  });
  await page.setViewport({ width: 1122, height: 794 });

  const filename = `cert_${event.id}_${user.id}_${Date.now()}.pdf`;
  const filePath = path.join(CERT_DIR, filename);

  await page.pdf({
    path: filePath,
    width: "1122px",
    height: "794px",
    printBackground: true,
  });
  await browser.close();

  // Save to DB
  const db = getDb();
  db.prepare(
    `
    INSERT OR REPLACE INTO certificates (event_id, user_id, file_path)
    VALUES (?, ?, ?)
  `,
  ).run(event.id, user.id, filePath);

  return filePath;
}

async function bulkGenerateCertificates(attendees, event) {
  const results = [];
  for (const user of attendees) {
    try {
      const filePath = await generateCertificate(user, event);
      results.push({ user, filePath, success: true });
    } catch (err) {
      results.push({ user, error: err.message, success: false });
    }
  }
  return results;
}

module.exports = { generateCertificate, bulkGenerateCertificates };
```

---

---

# QR AGENT — EVENTLINK CDM

---

name: qr
agent: QR_AGENT
role: QR code generation for registrations and attendance scanning
runs: STEP 7 (parallel)

---

## `electron/server/services/qrService.js`

```javascript
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const QR_DIR = path.join(__dirname, "../../../assets/qrcodes");
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

async function generateRegistrationQR(userId, eventId) {
  const payload = JSON.stringify({
    userId,
    eventId,
    type: "registration",
    ts: Date.now(),
  });
  const filename = `qr_${eventId}_${userId}.png`;
  const filePath = path.join(QR_DIR, filename);

  await QRCode.toFile(filePath, payload, {
    errorCorrectionLevel: "H",
    width: 400,
    margin: 2,
    color: { dark: "#1e3a8a", light: "#ffffff" },
  });

  return filePath;
}

async function generateQRDataURL(userId, eventId) {
  const payload = JSON.stringify({ userId, eventId, type: "registration" });
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "H",
    width: 300,
    color: { dark: "#1e3a8a" },
  });
}

function parseQRPayload(rawString) {
  try {
    return JSON.parse(rawString);
  } catch {
    return null;
  }
}

module.exports = { generateRegistrationQR, generateQRDataURL, parseQRPayload };
```
