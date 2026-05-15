/**
 * User Model — Encapsulates all user-related database operations.
 * 
 * INHERITANCE:    Extends BaseModel to inherit CRUD operations
 * POLYMORPHISM:   Overrides validate() and serialize() with User-specific logic
 * ENCAPSULATION:  Hides password hashing logic and validation rules
 */
const BaseModel = require('./BaseModel');

class User extends BaseModel {
  constructor() {
    super('users'); // Pass table name to parent (inheritance)
  }

  /**
   * @override — Polymorphic validation with User-specific rules.
   * BaseModel.validate() returns { valid: true } by default.
   * User overrides this with email, name, and password checks.
   */
  validate(data) {
    if (!data.full_name || data.full_name.trim().length < 2) {
      return { valid: false, error: 'Full name must be at least 2 characters' };
    }
    if (!/^[a-zA-ZñÑ\s]+$/.test(data.full_name)) {
      return { valid: false, error: 'Full name must contain only letters' };
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return { valid: false, error: 'Valid email address is required' };
    }
    if (data.student_id && !/^\d{2}-\d{5}$/.test(data.student_id)) {
      return { valid: false, error: 'Student ID must follow format 00-00000' };
    }
    if (data.year_level !== undefined && data.year_level !== null) {
      const yl = Number(data.year_level);
      if (isNaN(yl) || yl < 1 || yl > 4) {
        return { valid: false, error: 'Year level must be between 1 and 4' };
      }
    }
    return { valid: true };
  }

  /**
   * @override — Polymorphic serialization that strips sensitive fields.
   * Prevents password_hash from being exposed in API responses.
   */
  serialize(record) {
    if (!record) return null;
    const { password_hash, ...safeUser } = record;
    return safeUser;
  }

  /** Domain-specific query: find by email */
  async findByEmail(email) {
    const { queryOne } = require('../db/database');
    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
    return user || null;
  }

  /** Domain-specific: find by email and return with hash (for auth) */
  async findByEmailWithHash(email) {
    const { queryOne } = require('../db/database');
    return queryOne('SELECT * FROM users WHERE email = ?', [email]);
  }

  /** Domain-specific: get users by role */
  async findByRole(role, limit = 100) {
    const { queryAll } = require('../db/database');
    const rows = await queryAll(
      `SELECT * FROM users WHERE role = ? ORDER BY created_at DESC LIMIT ${parseInt(limit)}`, [role]
    );
    return rows.map(r => this.serialize(r));
  }
}

// Singleton export
module.exports = new User();
