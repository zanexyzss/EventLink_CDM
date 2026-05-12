---
name: database
agent: DATABASE_AGENT
role: SQLite schema, migrations, seeding, and database connection
runs: STEP 2
depends_on: ARCHITECT_AGENT
---

# DATABASE AGENT — EVENTLINK CDM

You create the complete database layer. Use `better-sqlite3` (synchronous, perfect for Electron). Reference schema from `00_MASTER_OVERVIEW.md` exactly — do NOT modify column names.

## FILES YOU MUST CREATE

### `electron/server/db/database.js`
```javascript
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

let db;

function getDbPath() {
  // In production, store in userData; in dev, use project root
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) return path.join(__dirname, '../../../eventlink.db');
  return path.join(app.getPath('userData'), 'eventlink.db');
}

function initDatabase() {
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations();
  seedDefaults();
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
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

    CREATE TABLE IF NOT EXISTS events (
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

    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('pending','confirmed','cancelled')) DEFAULT 'confirmed',
      qr_code_path TEXT,
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      method TEXT CHECK(method IN ('qr','manual')) DEFAULT 'manual',
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_path TEXT,
      sent_via_email INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_email TEXT,
      subject TEXT,
      type TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('sent','failed')) DEFAULT 'sent'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

function seedDefaults() {
  const bcrypt = require('bcryptjs');

  // Seed default admin if not exists
  const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@eventlink.cdm');
  if (!admin) {
    const hash = bcrypt.hashSync('Admin@1234', 10);
    db.prepare(`
      INSERT INTO users (full_name, email, password_hash, role, student_id)
      VALUES (?, ?, ?, 'admin', 'ADMIN-001')
    `).run('System Administrator', 'admin@eventlink.cdm', hash);
  }

  // Seed default settings
  const defaults = {
    'app_name': 'EVENTLINK CDM',
    'institution_name': 'CDM',
    'email_configured': '0',
    'certificate_template': 'default'
  };
  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaults)) {
    upsert.run(key, value);
  }
}

module.exports = { initDatabase, getDb };
```

## QUERY HELPERS TO PROVIDE (in `electron/server/db/queries.js`)

Provide these ready-made query functions:
```javascript
// users
getAllUsers(), getUserById(id), getUserByEmail(email), createUser(data), updateUser(id, data)

// events
getAllEvents(filters), getEventById(id), createEvent(data), updateEvent(id, data), deleteEvent(id)

// registrations
getEventRegistrations(eventId), getUserRegistrations(userId), createRegistration(eventId, userId), cancelRegistration(eventId, userId), getRegistrationCount(eventId)

// attendance
getEventAttendance(eventId), markAttendance(eventId, userId, method), getAttendanceStatus(eventId, userId)

// certificates
getCertificatesByEvent(eventId), createCertificate(data), markCertificatesSent(eventId)

// settings
getSetting(key), setSetting(key, value), getAllSettings()
```

## RULES
- Always use prepared statements — never string interpolation in SQL
- Return plain objects, not SQLite row objects (use `{...row}`)
- Wrap mutations in transactions when inserting multiple rows
- Return `null` if not found (never throw for missing records)
- `getDb()` must be called at the top of each query function

## VALIDATION CHECKLIST
- [ ] All 7 tables created
- [ ] Foreign keys enforced (`PRAGMA foreign_keys = ON`)
- [ ] Default admin seeded (email: admin@eventlink.cdm, pass: Admin@1234)
- [ ] Default settings seeded
- [ ] All query helpers exported and functional

## HANDOFF
Signal: **AUTH_AGENT and BACKEND_AGENT may now begin.**
Export: `getDb`, `initDatabase`, all query helpers
