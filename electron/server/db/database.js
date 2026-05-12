const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

async function initDatabase() {
  const dbName = process.env.DB_NAME || 'eventlink_cdm';
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
  };

  try {
    // 1. Create database if it doesn't exist
    const connection = await mysql.createConnection(dbConfig);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    // 2. Create the pool
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`[DB] Connected to MySQL database: ${dbName}`);

    // 3. Run Migrations & Defaults
    await runMigrations();
    await seedDefaults();

    return pool;
  } catch (err) {
    console.error('[DB] Initialization error:', err.message);
    throw err;
  }
}

// Keep initDatabaseSync around for backward compatibility in imports, but it's now async
async function initDatabaseSync() {
  return await initDatabase();
}

function getDb() {
  if (!pool) throw new Error('Database not initialized. Call initDatabase() first.');
  return pool;
}

// For MySQL, queries are async and return [rows, fields]
async function queryAll(sql, params = []) {
  if (!pool) throw new Error('DB not initialized');
  // MySQL requires ? for parameters, which matches SQLite's syntax
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// For mutations (INSERT/UPDATE/DELETE)
async function runSql(sql, params = []) {
  if (!pool) throw new Error('DB not initialized');
  const [result] = await pool.execute(sql, params);
  return { 
    lastInsertRowid: result.insertId || 0, 
    changes: result.affectedRows || 0 
  };
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(255) UNIQUE,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','organizer','student') DEFAULT 'student',
      department VARCHAR(255),
      year_level INT,
      profile_photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      event_type VARCHAR(255),
      venue VARCHAR(255),
      event_date DATETIME NOT NULL,
      registration_deadline DATETIME,
      max_slots INT,
      status ENUM('draft','open','closed','completed') DEFAULT 'draft',
      organizer_id INT,
      event_code VARCHAR(255) UNIQUE,
      banner_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT,
      user_id INT,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status ENUM('pending','confirmed','cancelled') DEFAULT 'confirmed',
      qr_code_path TEXT,
      UNIQUE KEY unique_registration (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT,
      user_id INT,
      checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      method ENUM('qr','manual','pin') DEFAULT 'manual',
      UNIQUE KEY unique_attendance (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_pins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT,
      pin_code VARCHAR(10) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT,
      user_id INT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_path TEXT,
      sent_via_email TINYINT(1) DEFAULT 0,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipient_email VARCHAR(255),
      subject VARCHAR(255),
      type VARCHAR(255),
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status ENUM('sent','failed') DEFAULT 'sent'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(255) PRIMARY KEY,
      value TEXT
    )
  `);
  
  console.log('[DB] MySQL Migrations complete — all 8 tables ready.');
}

async function seedDefaults() {
  const bcrypt = require('bcryptjs');
  const admin = await queryOne('SELECT id FROM users WHERE email = ?', ['admin@eventlink.cdm']);
  if (!admin) {
    const hash = bcrypt.hashSync('Admin@1234', 10);
    await runSql(
      'INSERT INTO users (full_name, email, password_hash, role, student_id) VALUES (?, ?, ?, ?, ?)',
      ['System Administrator', 'admin@eventlink.cdm', hash, 'admin', 'ADMIN-001']
    );
    console.log('[DB] Default admin seeded: admin@eventlink.cdm / Admin@1234');
  }

  const defaults = [
    ['app_name', 'EVENTLINK CDM'],
    ['institution_name', 'CDM'],
    ['email_configured', '0'],
    ['certificate_template', 'default']
  ];
  
  for (const [key, value] of defaults) {
    await runSql('INSERT IGNORE INTO settings (`key`, value) VALUES (?, ?)', [key, value]);
  }
}

// Stub for saveDb since MySQL saves immediately
function saveDb() {}

module.exports = { initDatabase, initDatabaseSync, getDb, queryAll, queryOne, runSql, saveDb };
