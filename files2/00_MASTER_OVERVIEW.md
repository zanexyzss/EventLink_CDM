# EVENTLINK CDM — MASTER SYSTEM OVERVIEW
**Desktop-Based Event Announcement and Registration System for Improving Student Participation**

---

## SYSTEM IDENTITY

| Field | Value |
|---|---|
| System Name | EVENTLINK CDM |
| Type | Desktop Application (Electron.js) |
| Purpose | Centralized event management for campus/institution |
| Target Users | Students, Event Organizers, Administrators |
| Build Mode | One-click, zero-debug autonomous generation |

---

## TECH STACK (CANONICAL — ALL AGENTS MUST FOLLOW)

```
DESKTOP SHELL     → Electron.js (v28+)
FRONTEND          → React 18 + Tailwind CSS
LOCAL BACKEND     → Python 3.11+ / FastAPI (spawned as subprocess by Electron)
DATABASE          → SQLite via aiosqlite + SQLAlchemy Core (async)
AUTH              → JWT (python-jose) + bcrypt (passlib)
EMAIL             → aiosmtplib + Jinja2 HTML templates
CERTIFICATES      → WeasyPrint (HTML-to-PDF) or ReportLab
QR CODES          → qrcode[pil] Python package
FILE STORAGE      → Local filesystem (pathlib.Path)
STATE MANAGEMENT  → Zustand (React)
ROUTING           → React Router v6
FORMS             → React Hook Form + Zod validation
ICONS             → Lucide React
CHARTS            → Recharts
PYTHON EXTRAS     → uvicorn, pydantic v2, python-dotenv, python-multipart
```

> ⚠️ ELECTRON SPAWNS PYTHON: `main.js` starts the FastAPI server via
> `child_process.spawn('python', ['-m', 'uvicorn', 'app.main:app', ...])`.
> React frontend talks to `http://localhost:8000/api`.

---

## SYSTEM FLOW (END-TO-END)

```
┌─────────────────────────────────────────────────────────────────┐
│                        EVENTLINK CDM FLOW                       │
└─────────────────────────────────────────────────────────────────┘

[1] ADMIN SETUP
    Admin logs in → Creates event (title, date, venue, slots, type)
    → System stores in SQLite → Generates unique event code/QR
    → Auto-sends announcement email to all registered students

[2] STUDENT DISCOVERY
    Student logs in → Sees event feed/dashboard
    → Views event details, slots available, deadline
    → Clicks "Register" button

[3] REGISTRATION
    Student fills form (or pre-filled from profile)
    → System validates: slot available? deadline passed? already registered?
    → Saves registration → Sends confirmation email with QR code
    → Admin notified (real-time count update)

[4] PRE-EVENT
    Admin views registrants list → Can export to CSV
    → Sends reminder emails (manual trigger or scheduled)
    → Can open/close registration

[5] EVENT DAY — ATTENDANCE
    Admin opens Attendance screen → Scans student QR or manual search
    → Marks present/absent → System logs timestamp

[6] POST-EVENT — CERTIFICATES
    Admin clicks "Generate Certificates"
    → System pulls all PRESENT attendees
    → Generates personalized PDF certificate per student
    → Bulk emails certificates as attachments
    → Certificates also saved locally for download

[7] ANALYTICS & REPORTS
    Admin views dashboard: registrations, attendance rate, events history
    → Export reports as PDF or CSV
```

---

## FOLDER STRUCTURE (CANONICAL)

```
eventlink-cdm/
├── package.json
├── electron/
│   ├── main.js              ← Electron entry, IPC bridge, Express boot
│   ├── preload.js           ← Context bridge (window.api)
│   └── server/
│       ├── app.js           ← Express app setup
│       ├── db/
│       │   ├── database.js  ← SQLite connection + init
│       │   └── migrations/  ← SQL migration files
│       ├── routes/
│       │   ├── auth.js
│       │   ├── events.js
│       │   ├── registrations.js
│       │   ├── attendance.js
│       │   ├── certificates.js
│       │   ├── users.js
│       │   └── reports.js
│       ├── middleware/
│       │   ├── auth.js      ← JWT verify middleware
│       │   └── role.js      ← Role guard (admin/student/organizer)
│       ├── services/
│       │   ├── emailService.js
│       │   ├── certificateService.js
│       │   ├── qrService.js
│       │   └── reportService.js
│       └── utils/
│           └── validators.js
├── src/
│   ├── main.jsx             ← React entry
│   ├── App.jsx              ← Router setup
│   ├── store/               ← Zustand stores
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Events/
│   │   │   ├── EventList.jsx
│   │   │   ├── EventDetail.jsx
│   │   │   └── CreateEvent.jsx
│   │   ├── Registration/
│   │   │   └── RegisterForm.jsx
│   │   ├── Attendance/
│   │   │   └── AttendanceScanner.jsx
│   │   ├── Certificates/
│   │   │   └── CertificateManager.jsx
│   │   ├── Admin/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── ManageUsers.jsx
│   │   │   └── Reports.jsx
│   │   └── Settings/
│   │       └── EmailSettings.jsx
│   ├── components/
│   │   ├── ui/              ← Reusable UI primitives
│   │   ├── EventCard.jsx
│   │   ├── RegistrationTable.jsx
│   │   ├── AttendanceRow.jsx
│   │   └── CertificatePreview.jsx
│   └── lib/
│       └── api.js           ← Axios instance pointing to localhost Express
├── assets/
│   ├── certificate-template.html
│   └── logo.png
└── public/
```

---

## DATABASE SCHEMA (CANONICAL)

```sql
-- USERS
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin','organizer','student')) DEFAULT 'student',
  department TEXT,
  year_level INTEGER,
  profile_photo TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- EVENTS
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT,
  venue TEXT,
  event_date DATETIME NOT NULL,
  registration_deadline DATETIME,
  max_slots INTEGER,
  status TEXT CHECK(status IN ('draft','open','closed','completed')) DEFAULT 'draft',
  organizer_id INTEGER REFERENCES users(id),
  event_code TEXT UNIQUE,
  banner_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- REGISTRATIONS
CREATE TABLE registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id),
  user_id INTEGER REFERENCES users(id),
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT CHECK(status IN ('pending','confirmed','cancelled')) DEFAULT 'confirmed',
  qr_code_path TEXT,
  UNIQUE(event_id, user_id)
);

-- ATTENDANCE
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id),
  user_id INTEGER REFERENCES users(id),
  checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  method TEXT CHECK(method IN ('qr','manual')) DEFAULT 'manual',
  UNIQUE(event_id, user_id)
);

-- CERTIFICATES
CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id),
  user_id INTEGER REFERENCES users(id),
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  file_path TEXT,
  sent_via_email INTEGER DEFAULT 0
);

-- EMAIL_LOG
CREATE TABLE email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_email TEXT,
  subject TEXT,
  type TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT CHECK(status IN ('sent','failed')) DEFAULT 'sent'
);

-- SETTINGS
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

---

## USER ROLES & PERMISSIONS

| Feature | Student | Organizer | Admin |
|---|---|---|---|
| View events | ✅ | ✅ | ✅ |
| Register for events | ✅ | ✅ | ✅ |
| Create events | ❌ | ✅ | ✅ |
| Manage registrations | ❌ | Own events | ✅ All |
| Mark attendance | ❌ | Own events | ✅ All |
| Generate certificates | ❌ | Own events | ✅ All |
| Manage users | ❌ | ❌ | ✅ |
| View analytics | ❌ | Own events | ✅ All |
| Configure email | ❌ | ❌ | ✅ |

---

## API ENDPOINTS (CANONICAL CONTRACT)

```
AUTH
  POST   /api/auth/login
  POST   /api/auth/register
  GET    /api/auth/me
  POST   /api/auth/logout

EVENTS
  GET    /api/events              → list (with filters)
  POST   /api/events              → create (organizer+)
  GET    /api/events/:id          → detail
  PUT    /api/events/:id          → update
  DELETE /api/events/:id          → soft delete
  POST   /api/events/:id/open     → open registration
  POST   /api/events/:id/close    → close registration

REGISTRATIONS
  GET    /api/events/:id/registrations   → list registrants
  POST   /api/events/:id/register        → student registers
  DELETE /api/events/:id/register        → student cancels
  GET    /api/registrations/mine         → my registrations

ATTENDANCE
  GET    /api/events/:id/attendance      → list attendance
  POST   /api/events/:id/attendance      → mark present {user_id, method}
  GET    /api/events/:id/attendance/:uid → check status

CERTIFICATES
  POST   /api/events/:id/certificates/generate  → bulk generate
  POST   /api/events/:id/certificates/send      → bulk email
  GET    /api/certificates/mine                 → my certificates

USERS (Admin)
  GET    /api/users
  GET    /api/users/:id
  PUT    /api/users/:id
  DELETE /api/users/:id

REPORTS
  GET    /api/reports/events/:id         → event report
  GET    /api/reports/overall            → system report
  GET    /api/reports/export/:id         → CSV export

SETTINGS
  GET    /api/settings
  PUT    /api/settings
```

---

## EMAIL TRIGGERS (AUTOMATIC)

| Trigger | Recipients | Template |
|---|---|---|
| Event created/published | All students | `event_announcement` |
| Student registers | Registrant | `registration_confirmation` |
| Registration reminder | All registrants | `event_reminder` |
| Event cancelled | All registrants | `event_cancelled` |
| Certificate ready | Attendee | `certificate_email` (with PDF attachment) |

---

## AGENT EXECUTION ORDER (ORCHESTRATION)

```
STEP 1 → ARCHITECT_AGENT     → scaffold folders, package.json, configs
STEP 2 → DATABASE_AGENT      → create DB schema, migrations, seed
STEP 3 → AUTH_AGENT          → JWT login/register endpoints + middleware
STEP 4 → BACKEND_AGENT       → all API routes + business logic
STEP 5 → EMAIL_AGENT         → Nodemailer setup + all templates
STEP 6 → CERTIFICATE_AGENT   → PDF generation + bulk send
STEP 7 → QR_AGENT            → QR generation for registrations + attendance
STEP 8 → FRONTEND_AGENT      → all React pages + components + routing
STEP 9 → ELECTRON_AGENT      → main.js, preload.js, IPC, app packaging
STEP 10 → TESTING_AGENT      → validates all routes, UI flows, no errors
```

**Agents run in sequence for dependencies; STEP 4–7 can run in parallel after STEP 3.**

---

## ONE-CLICK BUILD RULE

When a user says **"build EVENTLINK CDM"** or **"start the system"**:
1. Read this master document first
2. Execute agents in order above
3. Each agent reads its own SKILL.md before writing code
4. No placeholder code — every file must be complete and functional
5. No `// TODO` comments — implement or omit
6. After all agents complete, run TESTING_AGENT to verify
7. Output: working Electron app ready to `npm install && npm start`
