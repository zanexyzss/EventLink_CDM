const { initDatabaseSync, getDb } = require('./electron/server/db/database.js');

initDatabaseSync().then(db => {
  try {
    const res = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='attendance'");
    console.log(JSON.stringify(res, null, 2));

    db.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE new_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        method TEXT CHECK(method IN ('qr','manual','pin')) DEFAULT 'manual',
        UNIQUE(event_id, user_id)
      );
      INSERT INTO new_attendance (id, event_id, user_id, checked_in_at, method)
      SELECT id, event_id, user_id, checked_in_at, method FROM attendance;
      DROP TABLE attendance;
      ALTER TABLE new_attendance RENAME TO attendance;
      PRAGMA foreign_keys = ON;
    `);
    
    // Have to call saveDb or something equivalent.
    const { saveDb } = require('./electron/server/db/database.js');
    saveDb();
    console.log("Migration successful");
  } catch (err) {
    console.error(err);
  }
});
