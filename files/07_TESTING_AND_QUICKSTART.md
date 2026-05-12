---
name: testing
agent: TESTING_AGENT
role: Validate the complete system — no errors, no debugging needed
runs: STEP 10 — final agent
depends_on: ALL agents
---

# TESTING AGENT — EVENTLINK CDM

You are the quality gate. Your job is to verify the complete system works end-to-end with zero debugging required by the user. You do NOT write test files — you verify code correctness by reading each file and checking against the checklists below.

## VALIDATION PROTOCOL

For each module, read the code and verify all items. If something is broken, FIX IT immediately (rewrite the broken section) rather than reporting it as an error.

---

## CHECKLIST 1: ARCHITECTURE
- [ ] `package.json` has all required dependencies (no missing packages)
- [ ] All folders from ARCHITECT_AGENT exist
- [ ] `.env.example` has all required keys
- [ ] No circular imports between files
- [ ] `vite.config.js` and `tailwind.config.js` are correct

## CHECKLIST 2: DATABASE
- [ ] `database.js` exports `initDatabase` and `getDb`
- [ ] All 7 tables created in schema
- [ ] `PRAGMA foreign_keys = ON` set
- [ ] Default admin user seeded (email: admin@eventlink.cdm)
- [ ] `queries.js` exports all required functions
- [ ] No raw SQL string interpolation (all prepared statements)

## CHECKLIST 3: AUTHENTICATION
- [ ] POST `/api/auth/login` returns `{token, user}` (no password_hash)
- [ ] POST `/api/auth/register` validates required fields
- [ ] GET `/api/auth/me` requires valid token
- [ ] `authenticateToken` middleware rejects missing/invalid tokens with 401/403
- [ ] Role guards (`requireAdmin`, `requireOrganizer`) work correctly
- [ ] Zustand auth store persists token to localStorage

## CHECKLIST 4: BACKEND ROUTES
- [ ] All 8 route files exist and are mounted in `app.js`
- [ ] `GET /api/events` returns list without crashing
- [ ] `POST /api/events` validates required fields (title, event_date)
- [ ] `POST /api/events/:id/register` checks: slot available, deadline, not duplicate
- [ ] `POST /api/events/:id/attendance` accepts `{user_id, method}`
- [ ] `GET /api/reports/export/:id` returns CSV format
- [ ] All routes return proper HTTP status codes

## CHECKLIST 5: EMAIL SERVICE
- [ ] `emailService.js` exports: `sendEventAnnouncement`, `sendRegistrationConfirmation`, `sendCertificate`, `sendEventReminder`, `bulkSendAnnouncement`, `bulkSendCertificates`
- [ ] Failed emails are logged in `email_log` table (don't crash the request)
- [ ] Email HTML templates are complete (no broken HTML tags)
- [ ] Attachments are only added when `qrCodePath`/`certificatePath` exists

## CHECKLIST 6: CERTIFICATES
- [ ] `certificateService.js` exports `generateCertificate` and `bulkGenerateCertificates`
- [ ] Output directory `assets/certificates/` is created if missing
- [ ] PDF is generated at correct path
- [ ] DB record inserted after generation
- [ ] Puppeteer uses `{ headless: 'new' }` (not deprecated `true`)

## CHECKLIST 7: QR CODES
- [ ] `qrService.js` exports `generateRegistrationQR`, `generateQRDataURL`, `parseQRPayload`
- [ ] Output directory `assets/qrcodes/` is created if missing
- [ ] QR payload includes `{userId, eventId, type}`
- [ ] `parseQRPayload` handles malformed input gracefully (try/catch)

## CHECKLIST 8: FRONTEND
- [ ] `App.jsx` has all 10 routes defined
- [ ] `ProtectedRoute` redirects unauthenticated users to `/login`
- [ ] Role-based route protection works (student → 403 on admin routes)
- [ ] `Layout.jsx` renders sidebar with role-aware links
- [ ] All 10 pages exist and render without crashing
- [ ] `api.js` points to `http://localhost:3001/api`
- [ ] Auth store `restoreToken()` called in `App.jsx` on mount
- [ ] All 7 UI components exist (`Button`, `Input`, `Modal`, `Badge`, `Toast`, `EventCard`, `Spinner`)

## CHECKLIST 9: ELECTRON
- [ ] `main.js` calls `initDatabase()` before `createWindow()`
- [ ] Express server started before window loads
- [ ] `preload.js` exposes `electronAPI` via `contextBridge`
- [ ] `nodeIntegration: false` and `contextIsolation: true` set
- [ ] Dev mode loads `http://localhost:5173`, prod loads `dist/index.html`

## CHECKLIST 10: INTEGRATION FLOWS

### Flow 1: Admin publishes event → Students receive email
```
1. Admin POST /api/events → {title, event_date, venue, max_slots}
2. Admin POST /api/events/:id/open
3. System calls bulkSendAnnouncement(allStudents, event)
4. Email logged in email_log
✅ PASS if: event created, status = 'open', email logged
```

### Flow 2: Student registers → Gets QR + confirmation email
```
1. Student POST /api/events/:id/register
2. System calls generateRegistrationQR(userId, eventId)
3. System calls sendRegistrationConfirmation(user, event, qrPath)
4. Registration saved with qr_code_path
✅ PASS if: registration in DB, qr file exists, email logged
```

### Flow 3: Attendance marked → Certificate generated → Emailed
```
1. Admin POST /api/events/:id/attendance {user_id, method: 'manual'}
2. Admin POST /api/events/:id/certificates/generate
3. System generates PDF for each attendee
4. Admin POST /api/events/:id/certificates/send
5. System emails PDFs, marks sent_via_email = 1
✅ PASS if: attendance in DB, PDFs exist, emails logged, sent_via_email = 1
```

## IF YOU FIND AN ERROR

**DO NOT** report it and stop. Instead:
1. Identify the root cause
2. Rewrite the broken section with the fix
3. Re-verify the checklist item
4. Continue to next item

The goal: when TESTING_AGENT finishes, the user can run `npm install && npm start` and the app works.

## FINAL OUTPUT

After all checklists pass, output:
```
╔══════════════════════════════════════════╗
║     EVENTLINK CDM — BUILD COMPLETE ✅    ║
╠══════════════════════════════════════════╣
║ To start:                                ║
║   1. cp .env.example .env                ║
║   2. Edit .env with your email settings  ║
║   3. npm install                         ║
║   4. npm start                           ║
║                                          ║
║ Default admin:                           ║
║   Email: admin@eventlink.cdm             ║
║   Pass:  Admin@1234                      ║
║                                          ║
║ Features ready:                          ║
║   ✅ Event management                    ║
║   ✅ Student registration + QR codes     ║
║   ✅ Email notifications                 ║
║   ✅ Attendance tracking                 ║
║   ✅ Automated PDF certificates          ║
║   ✅ Analytics & reports                 ║
║   ✅ Role-based access control           ║
╚══════════════════════════════════════════╝
```

---
---

# QUICK START GUIDE — HOW TO BUILD EVENTLINK CDM WITH CLAUDE

## Method 1: One-Shot Prompt (Recommended)

Paste this into Claude:

```
You are building EVENTLINK CDM — a desktop-based event registration system.

Read the master documentation and agent skill files in order, then build the complete system:

1. Read 00_MASTER_OVERVIEW.md for system overview and tech stack
2. Execute each agent SKILL.md in sequence (01 → 10)
3. For each agent: read its SKILL.md, implement ALL files it specifies, output complete working code
4. No placeholders, no TODOs, no stubs — every file must be complete
5. After all agents complete, run TESTING_AGENT checklist and fix any issues

Begin with ARCHITECT_AGENT. Scaffold the project and output every file it specifies.
Then proceed to DATABASE_AGENT, AUTH_AGENT, and so on.

Do not stop until TESTING_AGENT outputs the BUILD COMPLETE confirmation.
```

## Method 2: Agent by Agent

Run each agent separately for maximum control:
```
"Act as ARCHITECT_AGENT for EVENTLINK CDM. Read 02_ARCHITECT_SKILL.md and produce all files it specifies."
"Act as DATABASE_AGENT for EVENTLINK CDM. Read 03_DATABASE_SKILL.md and produce all files it specifies."
... and so on
```

## Method 3: Parallel Agents (Advanced)

After AUTH_AGENT completes, open 4 parallel Claude conversations:
- Conversation A: BACKEND_AGENT
- Conversation B: EMAIL_AGENT  
- Conversation C: CERTIFICATE_AGENT
- Conversation D: QR_AGENT

Then merge outputs into the project folder, then run FRONTEND_AGENT, then ELECTRON_AGENT, then TESTING_AGENT.

## IMPORTANT NOTES

- Always provide `00_MASTER_OVERVIEW.md` as context in every agent conversation
- If Claude asks to clarify — skip clarification, use master doc defaults
- The `.env` file is the only thing the user needs to configure (email credentials)
- Default admin credentials are always: `admin@eventlink.cdm` / `Admin@1234`
