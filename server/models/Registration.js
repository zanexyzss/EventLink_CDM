/**
 * Registration Model — Encapsulates event registration operations.
 * 
 * INHERITANCE:    Extends BaseModel for CRUD
 * POLYMORPHISM:   Overrides validate() with registration-specific rules
 * ENCAPSULATION:  Hides composite-key logic behind clean methods
 */
const BaseModel = require('./BaseModel');

class Registration extends BaseModel {
  constructor() {
    super('registrations');
  }

  /** @override — Polymorphic validation for registrations */
  validate(data) {
    if (!data.event_id) {
      return { valid: false, error: 'Event ID is required' };
    }
    if (!data.user_id) {
      return { valid: false, error: 'User ID is required' };
    }
    return { valid: true };
  }

  /** Domain-specific: find by composite key (event + user) */
  async findByEventAndUser(eventId, userId) {
    const { queryOne } = require('../db/database');
    return queryOne(
      'SELECT * FROM registrations WHERE event_id = ? AND user_id = ?',
      [eventId, userId]
    );
  }

  /** Domain-specific: get all registrations for an event with user details */
  async findByEventWithUsers(eventId) {
    const { queryAll } = require('../db/database');
    return queryAll(`
      SELECT r.*, u.full_name, u.email, u.student_id, u.department, u.year_level
      FROM registrations r JOIN users u ON r.user_id = u.id
      WHERE r.event_id = ? AND r.status = 'confirmed'
      ORDER BY r.registered_at DESC
    `, [eventId]);
  }

  /** Domain-specific: get all registrations for a user with event details */
  async findByUserWithEvents(userId) {
    const { queryAll } = require('../db/database');
    return queryAll(`
      SELECT r.*, e.title, e.event_date, e.venue, e.status as event_status, e.event_type
      FROM registrations r JOIN events e ON r.event_id = e.id
      WHERE r.user_id = ? AND r.status = 'confirmed'
      ORDER BY e.event_date DESC
    `, [userId]);
  }

  /** Domain-specific: count confirmed registrations for an event */
  async countConfirmed(eventId) {
    const { queryOne } = require('../db/database');
    const row = await queryOne(
      "SELECT COUNT(*) as total FROM registrations WHERE event_id = ? AND status='confirmed'",
      [eventId]
    );
    return row ? row.total : 0;
  }

  /** Domain-specific: cancel a registration (delete by composite key) */
  async cancelByEventAndUser(eventId, userId) {
    const { runSql } = require('../db/database');
    return runSql(
      'DELETE FROM registrations WHERE event_id = ? AND user_id = ?',
      [eventId, userId]
    );
  }
}

module.exports = new Registration();
