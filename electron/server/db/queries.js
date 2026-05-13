const { getDb, queryAll, queryOne, runSql, saveDb } = require('./database');

// ─── USERS ──────────────────────────────────────────────────
async function getAllUsers({ role, search, limit = 20, offset = 0 } = {}) {
  let sql = 'SELECT id, student_id, full_name, email, role, department, year_level, profile_photo, created_at FROM users WHERE 1=1';
  const params = [];

  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (search) { sql += ' AND (full_name LIKE ? OR email LIKE ? OR student_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const countSql = sql.replace(/^SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
  const countRow = await queryOne(countSql, params);
  const total = countRow ? countRow.total : 0;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  // MySQL limits require numbers, wait actually pool.execute converts correctly
  params.push(limit.toString(), offset.toString()); // mysql2 execute requires string or string-castable if not prepared properly, but let's cast them. Actually, passing numbers to LIMIT sometimes breaks in mysql2 prepared statements without strict types. Let's just cast.
  
  // Safe limit/offset for mysql2
  const finalSql = sql.replace('LIMIT ? OFFSET ?', `LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`);
  params.pop(); params.pop();

  const users = await queryAll(finalSql, params);
  return { users, total };
}

async function getUserById(id) {
  return await queryOne('SELECT * FROM users WHERE id = ?', [id]);
}

async function getUserByEmail(email) {
  return await queryOne('SELECT * FROM users WHERE email = ?', [email]);
}

async function createUser({ full_name, email, password_hash, student_id, department, year_level, role = 'student' }) {
  const result = await runSql(
    'INSERT INTO users (full_name, email, password_hash, student_id, department, year_level, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [full_name, email, password_hash, student_id || null, department || null, year_level || null, role]
  );
  return await getUserById(result.lastInsertRowid);
}

async function updateUser(id, data) {
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields.push(`\`${k}\` = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return await getUserById(id);
  values.push(id);
  await runSql(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return await getUserById(id);
}

async function deleteUser(id) {
  return await runSql('DELETE FROM users WHERE id = ?', [id]);
}

// ─── EVENTS ─────────────────────────────────────────────────
async function getDashboardStats(userId, role) {
  if (role === 'admin' || role === 'organizer') {
    const totalEvents = (await queryOne('SELECT COUNT(*) as c FROM events')).c;
    const totalUsers = (await queryOne("SELECT COUNT(*) as c FROM users WHERE role='student'")).c;
    const totalRegistrations = (await queryOne('SELECT COUNT(*) as c FROM registrations')).c;
    const activeEvents = (await queryOne("SELECT COUNT(*) as c FROM events WHERE status='open'")).c;
    return { totalEvents, totalUsers, totalRegistrations, activeEvents };
  } else {
    const registered = (await queryOne('SELECT COUNT(*) as c FROM registrations WHERE user_id = ?', [userId])).c;
    const attended = (await queryOne('SELECT COUNT(*) as c FROM attendance WHERE user_id = ?', [userId])).c;
    const certificates = (await queryOne('SELECT COUNT(*) as c FROM certificates WHERE user_id = ?', [userId])).c;
    return { registered, attended, certificates };
  }
}

async function getAllEvents({ status, organizer_id, search, limit = 20, offset = 0 } = {}) {
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (organizer_id) { sql += ' AND organizer_id = ?'; params.push(organizer_id); }
  if (search) { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const countRow = await queryOne(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
  const total = countRow ? countRow.total : 0;

  const finalSql = sql + ` ORDER BY event_date DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
  const events = await queryAll(finalSql, params);
  return { events, total };
}

async function getEventById(id) {
  const event = await queryOne('SELECT e.*, u.full_name as organizer_name FROM events e LEFT JOIN users u ON e.organizer_id = u.id WHERE e.id = ?', [id]);
  if (event) {
    const c = await queryOne("SELECT COUNT(*) as total FROM registrations WHERE event_id = ? AND status='confirmed'", [id]);
    event.registered_count = c.total;
  }
  return event;
}

async function createEvent({ title, description, event_type, venue, event_date, registration_deadline, max_slots, status = 'draft', organizer_id, event_code, banner_path }) {
  const result = await runSql(
    `INSERT INTO events (title, description, event_type, venue, event_date, registration_deadline, max_slots, status, organizer_id, event_code, banner_path) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description, event_type, venue, event_date, registration_deadline || null, max_slots || null, status, organizer_id, event_code || null, banner_path || null]
  );
  return await getEventById(result.lastInsertRowid);
}

async function updateEvent(id, data) {
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields.push(`\`${k}\` = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return await getEventById(id);
  values.push(id);
  await runSql(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`, values);
  return await getEventById(id);
}

async function deleteEvent(id) {
  return await runSql('DELETE FROM events WHERE id = ?', [id]);
}

// ─── REGISTRATIONS ──────────────────────────────────────────
async function getEventRegistrations(eventId) {
  return await queryAll(`
    SELECT r.*, u.full_name, u.email, u.student_id, u.department, u.year_level
    FROM registrations r JOIN users u ON r.user_id = u.id
    WHERE r.event_id = ? AND r.status = 'confirmed'
    ORDER BY r.registered_at DESC
  `, [eventId]);
}

async function getUserRegistrations(userId) {
  return await queryAll(`
    SELECT r.*, e.title, e.event_date, e.venue, e.status as event_status, e.event_type
    FROM registrations r JOIN events e ON r.event_id = e.id
    WHERE r.user_id = ? AND r.status = 'confirmed'
    ORDER BY e.event_date DESC
  `, [userId]);
}

async function createRegistration(eventId, userId) {
  return await runSql('INSERT INTO registrations (event_id, user_id) VALUES (?, ?)', [eventId, userId]);
}

async function cancelRegistration(eventId, userId) {
  return await runSql('DELETE FROM registrations WHERE event_id = ? AND user_id = ?', [eventId, userId]);
}

async function getRegistrationCount(eventId) {
  const row = await queryOne("SELECT COUNT(*) as c FROM registrations WHERE event_id = ? AND status='confirmed'", [eventId]);
  return row ? row.c : 0;
}

async function getRegistration(eventId, userId) {
  return await queryOne('SELECT * FROM registrations WHERE event_id = ? AND user_id = ?', [eventId, userId]);
}

async function updateRegistrationQR(eventId, userId, qrPath) {
  return await runSql('UPDATE registrations SET qr_code_path = ? WHERE event_id = ? AND user_id = ?', [qrPath, eventId, userId]);
}

// ─── ATTENDANCE ─────────────────────────────────────────────
async function getEventAttendance(eventId) {
  return await queryAll(`
    SELECT a.*, u.full_name, u.email, u.student_id, u.department
    FROM attendance a JOIN users u ON a.user_id = u.id
    WHERE a.event_id = ?
    ORDER BY a.checked_in_at DESC
  `, [eventId]);
}

async function markAttendance(eventId, userId, method = 'manual') {
  const existing = await queryOne('SELECT id FROM attendance WHERE event_id = ? AND user_id = ?', [eventId, userId]);
  if (existing) return existing;

  const result = await runSql(
    'INSERT INTO attendance (event_id, user_id, method) VALUES (?, ?, ?)',
    [eventId, userId, method]
  );
  return await queryOne('SELECT * FROM attendance WHERE id = ?', [result.lastInsertRowid]);
}

async function getAttendanceStatus(eventId, userId) {
  return await queryOne('SELECT * FROM attendance WHERE event_id = ? AND user_id = ?', [eventId, userId]);
}

async function getAttendanceCount(eventId) {
  const row = await queryOne('SELECT COUNT(*) as c FROM attendance WHERE event_id = ?', [eventId]);
  return row ? row.c : 0;
}

// ─── CERTIFICATES ───────────────────────────────────────────
async function getEventCertificates(eventId) {
  return await queryAll(`
    SELECT c.*, u.full_name, u.email
    FROM certificates c JOIN users u ON c.user_id = u.id
    WHERE c.event_id = ?
    ORDER BY c.generated_at DESC
  `, [eventId]);
}

async function getUserCertificates(userId) {
  return await queryAll(`
    SELECT c.*, e.title, e.event_date
    FROM certificates c JOIN events e ON c.event_id = e.id
    WHERE c.user_id = ?
    ORDER BY c.generated_at DESC
  `, [userId]);
}

async function createCertificateRecord(eventId, userId, filePath, pdfData = null) {
  const existing = await queryOne('SELECT id FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, userId]);
  if (existing) {
    if (pdfData) {
      await runSql('UPDATE certificates SET file_path = ?, pdf_data = ?, generated_at = CURRENT_TIMESTAMP WHERE id = ?', [filePath, pdfData, existing.id]);
    } else {
      await runSql('UPDATE certificates SET file_path = ?, generated_at = CURRENT_TIMESTAMP WHERE id = ?', [filePath, existing.id]);
    }
    return existing.id;
  }
  if (pdfData) {
    const result = await runSql('INSERT INTO certificates (event_id, user_id, file_path, pdf_data) VALUES (?, ?, ?, ?)', [eventId, userId, filePath, pdfData]);
    return result.lastInsertRowid;
  } else {
    const result = await runSql('INSERT INTO certificates (event_id, user_id, file_path) VALUES (?, ?, ?)', [eventId, userId, filePath]);
    return result.lastInsertRowid;
  }
}

async function updateCertificateEmailStatus(certId, status) {
  return await runSql('UPDATE certificates SET sent_via_email = ? WHERE id = ?', [status ? 1 : 0, certId]);
}

async function getCertificate(eventId, userId) {
  return await queryOne('SELECT * FROM certificates WHERE event_id = ? AND user_id = ?', [eventId, userId]);
}

// ─── SETTINGS ───────────────────────────────────────────────
async function getSetting(key, defaultValue = null) {
  const row = await queryOne('SELECT value FROM settings WHERE `key` = ?', [key]);
  return row ? row.value : defaultValue;
}

async function setSetting(key, value) {
  return await runSql('INSERT INTO settings ("key", value) VALUES (?, ?) ON CONFLICT ("key") DO UPDATE SET value = EXCLUDED.value', [key, value]);
}

async function getAllSettings() {
  const rows = await queryAll('SELECT * FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

module.exports = {
  getAllUsers, getUserById, getUserByEmail, createUser, updateUser, deleteUser,
  getDashboardStats, getAllEvents, getEventById, createEvent, updateEvent, deleteEvent,
  getEventRegistrations, getUserRegistrations, createRegistration, cancelRegistration,
  getRegistrationCount, getRegistration, updateRegistrationQR,
  getEventAttendance, markAttendance, getAttendanceStatus, getAttendanceCount,
  getEventCertificates, getUserCertificates, createCertificateRecord, updateCertificateEmailStatus, getCertificate,
  getSetting, setSetting, getAllSettings
};
