/**
 * BaseModel — Abstract base class for all data models.
 * 
 * OOP Principles:
 * • ABSTRACTION:   Common CRUD interface for all entities
 * • ENCAPSULATION: Table name and DB functions are private
 * • INHERITANCE:   User, Event, Registration extend this class
 * • POLYMORPHISM:  Subclasses override validate() and serialize()
 */
const { queryAll, queryOne, runSql } = require('../db/database');

class BaseModel {
  #tableName;
  #primaryKey;

  constructor(tableName, primaryKey = 'id') {
    if (new.target === BaseModel) {
      throw new Error('BaseModel is abstract and cannot be instantiated directly.');
    }
    this.#tableName = tableName;
    this.#primaryKey = primaryKey;
  }

  get tableName() { return this.#tableName; }
  get primaryKey() { return this.#primaryKey; }

  /**
   * Abstract validation method — each subclass defines its own rules.
   * POLYMORPHISM: same method name, different behavior per model.
   * @param {Object} data 
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(data) {
    return { valid: true };
  }

  /**
   * Abstract serialization — each subclass controls what fields to expose.
   * Prevents sensitive data (e.g. password_hash) from leaking.
   * @param {Object} record 
   * @returns {Object} Safe representation
   */
  serialize(record) {
    return record;
  }

  async findById(id) {
    const record = await queryOne(`SELECT * FROM ${this.#tableName} WHERE ${this.#primaryKey} = ?`, [id]);
    return record ? this.serialize(record) : null;
  }

  async findAll(conditions = {}, limit = 20, offset = 0) {
    let sql = `SELECT * FROM ${this.#tableName} WHERE 1=1`;
    const params = [];
    for (const [key, value] of Object.entries(conditions)) {
      sql += ` AND ${key} = ?`;
      params.push(value);
    }
    sql += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    const rows = await queryAll(sql, params);
    return rows.map(r => this.serialize(r));
  }

  async count(conditions = {}) {
    let sql = `SELECT COUNT(*) as total FROM ${this.#tableName} WHERE 1=1`;
    const params = [];
    for (const [key, value] of Object.entries(conditions)) {
      sql += ` AND ${key} = ?`;
      params.push(value);
    }
    const row = await queryOne(sql, params);
    return row ? row.total : 0;
  }

  async create(data) {
    const validation = this.validate(data);
    if (!validation.valid) throw new Error(validation.error);

    const keys = Object.keys(data).filter(k => data[k] !== undefined);
    const values = keys.map(k => data[k]);
    const placeholders = keys.map(() => '?').join(', ');
    const cols = keys.map(k => `\`${k}\``).join(', ');

    const result = await runSql(
      `INSERT INTO ${this.#tableName} (${cols}) VALUES (${placeholders})`,
      values
    );
    return this.findById(result.lastInsertRowid);
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        fields.push(`\`${k}\` = ?`);
        values.push(v);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    await runSql(`UPDATE ${this.#tableName} SET ${fields.join(', ')} WHERE ${this.#primaryKey} = ?`, values);
    return this.findById(id);
  }

  async delete(id) {
    return runSql(`DELETE FROM ${this.#tableName} WHERE ${this.#primaryKey} = ?`, [id]);
  }

  async exists(id) {
    const row = await queryOne(
      `SELECT ${this.#primaryKey} FROM ${this.#tableName} WHERE ${this.#primaryKey} = ?`, [id]
    );
    return !!row;
  }
}

module.exports = BaseModel;
