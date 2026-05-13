const { Pool } = require('pg');
require('dotenv').config();

let pool;

// Convert MySQL-style ? placeholders to PostgreSQL $1,$2,... and backticks to double quotes
function convertSql(sql) {
  let i = 0;
  let converted = sql.replace(/\?/g, () => `$${++i}`);
  converted = converted.replace(/`/g, '"');
  return converted;
}

async function initDatabase() {
  const dbName = process.env.DB_NAME || 'defaultdb';

  const poolConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: dbName,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    max: 10,
  };

  if (process.env.DB_SSL === 'true') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  try {
    pool = new Pool(poolConfig);

    // Test connection
    const client = await pool.connect();
    client.release();

    console.log(`[DB] Connected to PostgreSQL database: ${dbName}`);

    await runMigrations();
    await seedDefaults();

    return pool;
  } catch (err) {
    console.error('[DB] Initialization error:', err.message);
    throw err;
  }
}

async function initDatabaseSync() {
  return await initDatabase();
}

function getDb() {
  if (!pool) throw new Error('Database not initialized. Call initDatabase() first.');
  return pool;
}

async function queryAll(sql, params = []) {
  if (!pool) throw new Error('DB not initialized');
  const result = await pool.query(convertSql(sql), params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function runSql(sql, params = []) {
  if (!pool) throw new Error('DB not initialized');
  const converted = convertSql(sql);
  const isInsert = converted.trim().toUpperCase().startsWith('INSERT');
  const hasConflict = converted.toUpperCase().includes('ON CONFLICT');
  const hasReturning = converted.toUpperCase().includes('RETURNING');

  if (isInsert && !hasConflict && !hasReturning) {
    const result = await pool.query(converted + ' RETURNING id', params);
    return {
      lastInsertRowid: result.rows.length > 0 ? result.rows[0].id : 0,
      changes: result.rowCount || 0
    };
  } else {
    const result = await pool.query(converted, params);
    return {
      lastInsertRowid: result.rows && result.rows.length > 0 && result.rows[0].id ? result.rows[0].id : 0,
      changes: result.rowCount || 0
    };
  }
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      student_id VARCHAR(255) UNIQUE,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'student',
      department VARCHAR(255),
      year_level INT,
      profile_photo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      event_type VARCHAR(255),
      venue VARCHAR(255),
      event_date TIMESTAMP NOT NULL,
      registration_deadline TIMESTAMP,
      max_slots INT,
      status VARCHAR(50) DEFAULT 'draft',
      organizer_id INT REFERENCES users(id) ON DELETE SET NULL,
      event_code VARCHAR(255) UNIQUE,
      banner_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      event_id INT REFERENCES events(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'confirmed',
      qr_code_path TEXT,
      UNIQUE (event_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      event_id INT REFERENCES events(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      method VARCHAR(50) DEFAULT 'manual',
      UNIQUE (event_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_pins (
      id SERIAL PRIMARY KEY,
      event_id INT REFERENCES events(id) ON DELETE CASCADE,
      pin_code VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      is_active SMALLINT DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificates (
      id SERIAL PRIMARY KEY,
      event_id INT REFERENCES events(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      file_path TEXT,
      sent_via_email SMALLINT DEFAULT 0
    )
  `);

  await pool.query(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS pdf_data BYTEA;`);
  await pool.query(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS cert_title VARCHAR(500);`);
  await pool.query(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS speaker_name VARCHAR(255);`);
  await pool.query(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS speaker_title VARCHAR(255);`);
  await pool.query(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS cert_name_override VARCHAR(255);`);
  await pool.query(`ALTER TABLE certificates ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending';`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY,
      recipient_email VARCHAR(255),
      subject VARCHAR(255),
      type VARCHAR(255),
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'sent'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      "key" VARCHAR(255) PRIMARY KEY,
      value TEXT
    )
  `);

  console.log('[DB] PostgreSQL Migrations complete — all 8 tables ready.');
}

async function seedDefaults() {
  try {
    const bcrypt = require('bcryptjs');
    const email = 'admin@gmail.com';
    const defaultPassword = 'Admin@1234';
    const hash = bcrypt.hashSync(defaultPassword, 10);
    
    const admin = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    
    if (!admin) {
      await pool.query(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        ['System Admin', email, hash, 'admin']
      );
      console.log(`[DB] Default admin seeded: ${email} / ${defaultPassword}`);
    } else {
      await pool.query(
        'UPDATE users SET password_hash = $1, role = $2 WHERE email = $3',
        [hash, 'admin', email]
      );
      console.log(`[DB] Default admin credentials force-updated to: ${email} / ${defaultPassword}`);
    }
  } catch (err) {
    console.error('[DB] Admin seed error (non-fatal):', err.message);
  }

  try {
    const defaults = [
      ['app_name', 'EVENTLINK CDM'],
      ['institution_name', 'CDM'],
      ['email_configured', '0'],
      ['certificate_template', 'default']
    ];

    for (const [key, value] of defaults) {
      await pool.query(
        'INSERT INTO settings ("key", value) VALUES ($1, $2) ON CONFLICT ("key") DO NOTHING',
        [key, value]
      );
    }
  } catch (err) {
    console.error('[DB] Settings seed error (non-fatal):', err.message);
  }
}

function saveDb() {}

module.exports = { initDatabase, initDatabaseSync, getDb, queryAll, queryOne, runSql, saveDb };
