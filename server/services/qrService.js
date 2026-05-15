/**
 * QRService — Generates QR codes for event registrations.
 * 
 * OOP: Extends BaseService (INHERITANCE), uses private config (ENCAPSULATION),
 * overrides initialize() (POLYMORPHISM), hides QR logic (ABSTRACTION).
 */
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const BaseService = require('./BaseService');

class QRService extends BaseService {
  #defaultConfig;
  #qrDir;

  constructor() {
    super('QR');
    this.#qrDir = path.join(__dirname, '../../../assets/qrcodes');
    this.#defaultConfig = {
      errorCorrectionLevel: 'H',
      color: { dark: '#1e3a8a', light: '#ffffff' }
    };
    if (!fs.existsSync(this.#qrDir)) {
      fs.mkdirSync(this.#qrDir, { recursive: true });
    }
  }

  /** @override — Polymorphic initialization */
  async initialize() {
    await super.initialize();
    this.log(`QR directory: ${this.#qrDir}`);
    return true;
  }

  async generateRegistrationQR(userId, eventId) {
    this.validateRequired({ userId, eventId }, ['userId', 'eventId']);
    const payload = JSON.stringify({ userId, eventId, type: 'registration', ts: Date.now() });
    return this.executeWithErrorHandling(
      () => QRCode.toDataURL(payload, { ...this.#defaultConfig, width: 400, margin: 2 }),
      `QR generation failed for user ${userId}, event ${eventId}`
    );
  }

  async generateQRDataURL(userId, eventId) {
    const payload = JSON.stringify({ userId, eventId, type: 'registration' });
    return QRCode.toDataURL(payload, { ...this.#defaultConfig, width: 300 });
  }

  parseQRPayload(rawString) {
    try {
      return JSON.parse(rawString);
    } catch {
      this.logError('Failed to parse QR payload');
      return null;
    }
  }
}

// Singleton instance — backward-compatible exports
const instance = new QRService();

module.exports = {
  generateRegistrationQR: (userId, eventId) => instance.generateRegistrationQR(userId, eventId),
  generateQRDataURL: (userId, eventId) => instance.generateQRDataURL(userId, eventId),
  parseQRPayload: (raw) => instance.parseQRPayload(raw),
  QRService
};
