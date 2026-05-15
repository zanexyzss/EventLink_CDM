/**
 * CertificateService — Generates PDF certificates for event attendees.
 * 
 * OOP: Extends BaseService (INHERITANCE), encapsulates PDF config (ENCAPSULATION),
 * overrides initialize() (POLYMORPHISM), hides PDFKit complexity (ABSTRACTION).
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const BaseService = require('./BaseService');
const { createCertificateRecord } = require('../db/queries');

class CertificateService extends BaseService {
  #certDir;
  #pageConfig;

  constructor() {
    super('CERT');
    this.#certDir = path.join(__dirname, '../../assets/certificates');
    this.#pageConfig = { size: 'A4', layout: 'landscape', margin: 0, width: 841.89, height: 595.28 };
    if (!fs.existsSync(this.#certDir)) {
      fs.mkdirSync(this.#certDir, { recursive: true });
    }
  }

  /** @override — Polymorphic initialization */
  async initialize() {
    await super.initialize();
    this.log(`Certificate directory: ${this.#certDir}`);
    return true;
  }

  // ─── Private Helper: Build PDF with decorative elements ─────
  #drawBorders(doc, W, H) {
    doc.rect(0, 0, W, H).fill('#fdfbf5');
    doc.lineWidth(3).strokeColor('#c9a84c').rect(20, 20, W - 40, H - 40).stroke();
    doc.lineWidth(1).strokeColor('#d4af37').rect(30, 30, W - 60, H - 60).stroke();
    const cs = 40;
    doc.lineWidth(2).strokeColor('#c9a84c');
    [[25,25,1,1],[W-25,25,-1,1],[25,H-25,1,-1],[W-25,H-25,-1,-1]].forEach(([x,y,dx,dy]) => {
      doc.moveTo(x, y).lineTo(x + cs*dx, y).stroke();
      doc.moveTo(x, y).lineTo(x, y + cs*dy).stroke();
    });
  }

  #drawTitle(doc, W, displayTitle) {
    doc.lineWidth(1).strokeColor('#c9a84c');
    doc.moveTo(W/2 - 120, 65).lineTo(W/2 + 120, 65).stroke();
    doc.fontSize(11).fillColor('#8b7355').font('Helvetica').text('Colegio de Montalban', 0, 75, { align: 'center', width: W });
    const parts = displayTitle.split(' OF ');
    if (parts.length === 2) {
      doc.fontSize(36).fillColor('#1a1a2e').font('Helvetica-Bold').text(parts[0], 0, 105, { align: 'center', width: W });
      doc.fontSize(16).fillColor('#c9a84c').font('Helvetica').text(`OF ${parts[1]}`, 0, 148, { align: 'center', width: W, characterSpacing: 4 });
    } else {
      doc.fontSize(30).fillColor('#1a1a2e').font('Helvetica-Bold').text(displayTitle, 0, 115, { align: 'center', width: W });
    }
  }

  #drawDivider(doc, W, y) {
    doc.lineWidth(0.5).strokeColor('#c9a84c');
    doc.moveTo(W/2 - 100, y).lineTo(W/2 - 10, y).stroke();
    doc.moveTo(W/2 + 10, y).lineTo(W/2 + 100, y).stroke();
    doc.save(); doc.translate(W/2, y); doc.rotate(45);
    doc.rect(-4, -4, 8, 8).fill('#c9a84c'); doc.restore();
  }

  #drawRecipient(doc, W, name) {
    doc.fontSize(11).fillColor('#8b7355').font('Helvetica').text('This certificate is proudly presented to', 0, 195, { align: 'center', width: W });
    doc.fontSize(32).fillColor('#1a1a2e').font('Helvetica-Bold').text(name, 0, 225, { align: 'center', width: W });
    const nw = doc.widthOfString(name);
    doc.lineWidth(1).strokeColor('#c9a84c').moveTo((W-nw)/2, 265).lineTo((W+nw)/2, 265).stroke();
  }

  #drawEventInfo(doc, W, eventTitle, formattedDate, venue) {
    doc.fontSize(12).fillColor('#555555').font('Helvetica').text('For the successful completion of the', 0, 285, { align: 'center', width: W });
    doc.fontSize(18).fillColor('#2d2d7b').font('Helvetica-Bold').text(eventTitle, 0, 310, { align: 'center', width: W });
    doc.fontSize(11).fillColor('#555555').font('Helvetica').text(`held on ${formattedDate}${venue ? ` at ${venue}` : ''}.`, 0, 340, { align: 'center', width: W });
  }

  #drawFooter(doc, W, H, speakerTitle, speakerName, issuedDate, certId) {
    const fy = 400;
    // Left signature
    doc.lineWidth(1).strokeColor('#999999').moveTo(120, fy+40).lineTo(300, fy+40).stroke();
    doc.fontSize(10).fillColor('#666666').font('Helvetica').text(speakerTitle, 120, fy+45, { width: 180, align: 'center' });
    doc.fontSize(9).fillColor('#999999').text(speakerName, 120, fy+60, { width: 180, align: 'center' });
    // Center seal
    doc.save();
    doc.circle(W/2, fy+25, 30).lineWidth(2).strokeColor('#c9a84c').stroke();
    doc.circle(W/2, fy+25, 25).lineWidth(1).strokeColor('#d4af37').stroke();
    doc.fontSize(16).fillColor('#c9a84c').font('Helvetica-Bold').text('★', W/2-8, fy+10);
    doc.fontSize(7).fillColor('#c9a84c').font('Helvetica').text('VERIFIED', W/2-18, fy+30);
    doc.restore();
    doc.fontSize(9).fillColor('#999999').font('Helvetica').text('EventLink CDM', 0, fy+65, { align: 'center', width: W });
    doc.fontSize(8).fillColor('#aaaaaa').text(`Issued ${issuedDate}`, 0, fy+78, { align: 'center', width: W });
    // Right signature
    doc.lineWidth(1).strokeColor('#999999').moveTo(W-300, fy+40).lineTo(W-120, fy+40).stroke();
    doc.fontSize(10).fillColor('#666666').font('Helvetica').text('Administrator', W-300, fy+45, { width: 180, align: 'center' });
    doc.fontSize(9).fillColor('#999999').text('Admin', W-300, fy+60, { width: 180, align: 'center' });
    // Cert ID
    doc.fontSize(7).fillColor('#cccccc').font('Helvetica').text(`ID: ${certId}`, 0, H-45, { align: 'center', width: W });
  }

  // ─── Core PDF Generation (Template Method Pattern) ──────────
  #buildPDF(displayName, event, meta = {}) {
    return new Promise((resolve, reject) => {
      try {
        const { width: W, height: H } = this.#pageConfig;
        const eventDate = new Date(String(event.event_date).replace(' ', 'T'));
        const formattedDate = !isNaN(eventDate.getTime())
          ? eventDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : event.event_date;
        const issuedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const certId = 'CDM-' + (event.id || '0') + '-' + (meta.userId || '0') + '-' + Date.now().toString(36).toUpperCase();
        const displayTitle = meta.cert_title || 'CERTIFICATE OF PARTICIPATION';
        const speakerName = meta.speaker_name || event.organizer_name || 'Event Committee';
        const speakerTitle = meta.speaker_title || 'Event Organizer';

        const safeName = displayName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `cert_${event.id}_${meta.userId}_${safeName}.pdf`;
        const filePath = path.join(this.#certDir, filename);

        const doc = new PDFDocument({ size: this.#pageConfig.size, layout: this.#pageConfig.layout, margin: 0 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Compose the certificate using private helper methods
        this.#drawBorders(doc, W, H);
        this.#drawTitle(doc, W, displayTitle);
        this.#drawDivider(doc, W, 175);
        this.#drawRecipient(doc, W, displayName);
        this.#drawEventInfo(doc, W, event.title, formattedDate, event.venue);
        this.#drawFooter(doc, W, H, speakerTitle, speakerName, issuedDate, certId);

        doc.end();
        stream.on('finish', () => {
          try { resolve({ filePath, buffer: fs.readFileSync(filePath) }); }
          catch (e) { reject(e); }
        });
        stream.on('error', reject);
      } catch (err) { reject(err); }
    });
  }

  // ─── Public API ─────────────────────────────────────────────

  async generateCertificate(user, event) {
    this.validateRequired({ user, event }, ['user', 'event']);
    const { filePath, buffer } = await this.#buildPDF(user.full_name, event, { userId: user.id });
    await createCertificateRecord(event.id, user.id, filePath, buffer);
    this.log(`Generated for ${user.full_name}`);
    return filePath;
  }

  async generateSingleCertificate(user, event) {
    return this.generateCertificate(user, event);
  }

  async generateCertificateWithMeta(user, event, meta = {}) {
    const displayName = meta.cert_name_override || user.full_name;
    const { filePath } = await this.#buildPDF(displayName, event, { ...meta, userId: user.id });
    const buffer = fs.readFileSync(filePath);
    await createCertificateRecord(event.id, user.id, filePath, buffer);
    this.log(`Generated with meta for ${displayName}`);
    return filePath;
  }

  async bulkGenerateCertificates(attendees, event) {
    const results = [];
    for (const user of attendees) {
      try {
        const filePath = await this.generateCertificate(user, event);
        results.push({ user, filePath, success: true });
      } catch (err) {
        this.logError(`Failed for ${user.full_name}:`, err.message);
        results.push({ user, error: err.message, success: false });
      }
    }
    return results;
  }
}

// Singleton & backward-compatible exports
const instance = new CertificateService();

module.exports = {
  generateCertificate: (u, e) => instance.generateCertificate(u, e),
  generateSingleCertificate: (u, e) => instance.generateSingleCertificate(u, e),
  generateCertificateWithMeta: (u, e, m) => instance.generateCertificateWithMeta(u, e, m),
  bulkGenerateCertificates: (a, e) => instance.bulkGenerateCertificates(a, e),
  CertificateService
};
