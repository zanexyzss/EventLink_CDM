/**
 * Event Model — Encapsulates all event-related database operations.
 * 
 * INHERITANCE:    Extends BaseModel to inherit CRUD
 * POLYMORPHISM:   Overrides validate() with Event-specific rules
 * ENCAPSULATION:  Hides query complexity behind clean methods
 */
const BaseModel = require('./BaseModel');

class Event extends BaseModel {
  // Private: valid event statuses
  static #VALID_STATUSES = ['draft', 'open', 'closed', 'completed'];

  constructor() {
    super('events');
  }

  /** @override — Polymorphic validation for events */
  validate(data) {
    if (!data.title || data.title.trim().length < 2) {
      return { valid: false, error: 'Event title is required (min 2 characters)' };
    }
    if (!data.event_date) {
      return { valid: false, error: 'Event date is required' };
    }
    if (data.status && !Event.#VALID_STATUSES.includes(data.status)) {
      return { valid: false, error: `Invalid status. Must be: ${Event.#VALID_STATUSES.join(', ')}` };
    }
    if (data.max_slots !== undefined && data.max_slots !== null) {
      if (isNaN(data.max_slots) || data.max_slots < 0) {
        return { valid: false, error: 'Max slots must be a positive number' };
      }
    }
    return { valid: true };
  }

  /** Domain-specific: find with organizer name */
  async findByIdWithOrganizer(id) {
    const { queryOne } = require('../db/database');
    return queryOne(
      'SELECT e.*, u.full_name as organizer_name FROM events e LEFT JOIN users u ON e.organizer_id = u.id WHERE e.id = ?',
      [id]
    );
  }

  /** Domain-specific: find open events */
  async findOpen(limit = 20) {
    return this.findAll({ status: 'open' }, limit);
  }

  /** Domain-specific: transition event status */
  async transitionStatus(id, newStatus) {
    if (!Event.#VALID_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    return this.update(id, { status: newStatus });
  }
}

module.exports = new Event();
