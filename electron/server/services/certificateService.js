const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { createCertificateRecord } = require('../db/queries');

const CERT_DIR = path.join(__dirname, '../../../assets/certificates');
if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

function generateCertificatePDF(user, event) {
  return new Promise((resolve, reject) => {
    try {
      const eventDate = new Date(String(event.event_date).replace(' ', 'T'));
      const formattedDate = !isNaN(eventDate.getTime())
        ? eventDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : event.event_date;
      const issuedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const certId = 'CDM-' + (event.id || '0') + '-' + (user.id || '0') + '-' + Date.now().toString(36).toUpperCase();

      const safeName = user.full_name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `cert_${event.id}_${user.id}_${safeName}.pdf`;
      const filePath = path.join(CERT_DIR, filename);

      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const W = 841.89;
      const H = 595.28;

      // === BACKGROUND ===
      doc.rect(0, 0, W, H).fill('#fdfbf5');

      // === OUTER BORDER (gold) ===
      doc.lineWidth(3).strokeColor('#c9a84c')
        .rect(20, 20, W - 40, H - 40).stroke();

      // === INNER BORDER ===
      doc.lineWidth(1).strokeColor('#d4af37')
        .rect(30, 30, W - 60, H - 60).stroke();

      // === DECORATIVE CORNER ACCENTS ===
      const cornerSize = 40;
      // Top-left
      doc.lineWidth(2).strokeColor('#c9a84c');
      doc.moveTo(25, 25).lineTo(25 + cornerSize, 25).stroke();
      doc.moveTo(25, 25).lineTo(25, 25 + cornerSize).stroke();
      // Top-right
      doc.moveTo(W - 25, 25).lineTo(W - 25 - cornerSize, 25).stroke();
      doc.moveTo(W - 25, 25).lineTo(W - 25, 25 + cornerSize).stroke();
      // Bottom-left
      doc.moveTo(25, H - 25).lineTo(25 + cornerSize, H - 25).stroke();
      doc.moveTo(25, H - 25).lineTo(25, H - 25 - cornerSize).stroke();
      // Bottom-right
      doc.moveTo(W - 25, H - 25).lineTo(W - 25 - cornerSize, H - 25).stroke();
      doc.moveTo(W - 25, H - 25).lineTo(W - 25, H - 25 - cornerSize).stroke();

      // === TOP DECORATIVE LINE ===
      doc.lineWidth(1).strokeColor('#c9a84c');
      doc.moveTo(W / 2 - 120, 65).lineTo(W / 2 + 120, 65).stroke();

      // === INSTITUTION ===
      doc.fontSize(11).fillColor('#8b7355')
        .font('Helvetica').text('Colegio de Montalban', 0, 75, { align: 'center', width: W });

      // === TITLE ===
      doc.fontSize(36).fillColor('#1a1a2e')
        .font('Helvetica-Bold').text('CERTIFICATE', 0, 105, { align: 'center', width: W });
      doc.fontSize(16).fillColor('#c9a84c')
        .font('Helvetica').text('OF PARTICIPATION', 0, 148, { align: 'center', width: W, characterSpacing: 4 });

      // === DECORATIVE DIVIDER ===
      const divY = 175;
      doc.lineWidth(0.5).strokeColor('#c9a84c');
      doc.moveTo(W / 2 - 100, divY).lineTo(W / 2 - 10, divY).stroke();
      doc.moveTo(W / 2 + 10, divY).lineTo(W / 2 + 100, divY).stroke();
      // Diamond in center
      doc.save();
      doc.translate(W / 2, divY);
      doc.rotate(45);
      doc.rect(-4, -4, 8, 8).fill('#c9a84c');
      doc.restore();

      // === PRESENTED TO ===
      doc.fontSize(11).fillColor('#8b7355')
        .font('Helvetica').text('This certificate is proudly presented to', 0, 195, { align: 'center', width: W });

      // === NAME ===
      doc.fontSize(32).fillColor('#1a1a2e')
        .font('Helvetica-Bold').text(user.full_name, 0, 225, { align: 'center', width: W });

      // === NAME UNDERLINE ===
      const nameWidth = doc.widthOfString(user.full_name);
      const nameX = (W - nameWidth) / 2;
      doc.lineWidth(1).strokeColor('#c9a84c');
      doc.moveTo(nameX, 265).lineTo(nameX + nameWidth, 265).stroke();

      // === DESCRIPTION ===
      doc.fontSize(12).fillColor('#555555')
        .font('Helvetica').text(
          `For the successful completion of the`,
          0, 285, { align: 'center', width: W }
        );

      // === EVENT TITLE ===
      doc.fontSize(18).fillColor('#2d2d7b')
        .font('Helvetica-Bold').text(event.title, 0, 310, { align: 'center', width: W });

      // === EVENT DETAILS ===
      doc.fontSize(11).fillColor('#555555')
        .font('Helvetica').text(
          `held on ${formattedDate}${event.venue ? ` at ${event.venue}` : ''}.`,
          0, 340, { align: 'center', width: W }
        );

      // === FOOTER SECTION ===
      const footerY = 400;

      // Left signature
      doc.lineWidth(1).strokeColor('#999999');
      doc.moveTo(120, footerY + 40).lineTo(300, footerY + 40).stroke();
      doc.fontSize(10).fillColor('#666666')
        .font('Helvetica').text('Event Organizer', 120, footerY + 45, { width: 180, align: 'center' });
      doc.fontSize(9).fillColor('#999999')
        .text(event.organizer_name || 'Event Committee', 120, footerY + 60, { width: 180, align: 'center' });

      // Center seal
      doc.save();
      doc.circle(W / 2, footerY + 25, 30).lineWidth(2).strokeColor('#c9a84c').stroke();
      doc.circle(W / 2, footerY + 25, 25).lineWidth(1).strokeColor('#d4af37').stroke();
      doc.fontSize(16).fillColor('#c9a84c')
        .font('Helvetica-Bold').text('★', W / 2 - 8, footerY + 10);
      doc.fontSize(7).fillColor('#c9a84c')
        .font('Helvetica').text('VERIFIED', W / 2 - 18, footerY + 30);
      doc.restore();

      // System name below seal
      doc.fontSize(9).fillColor('#999999')
        .font('Helvetica').text('EventLink CDM', 0, footerY + 65, { align: 'center', width: W });
      doc.fontSize(8).fillColor('#aaaaaa')
        .text(`Issued ${issuedDate}`, 0, footerY + 78, { align: 'center', width: W });

      // Right signature
      doc.lineWidth(1).strokeColor('#999999');
      doc.moveTo(W - 300, footerY + 40).lineTo(W - 120, footerY + 40).stroke();
      doc.fontSize(10).fillColor('#666666')
        .font('Helvetica').text('Administrator', W - 300, footerY + 45, { width: 180, align: 'center' });
      doc.fontSize(9).fillColor('#999999')
        .text('System Administrator', W - 300, footerY + 60, { width: 180, align: 'center' });

      // === CERT ID ===
      doc.fontSize(7).fillColor('#cccccc')
        .font('Helvetica').text(`ID: ${certId}`, 0, H - 45, { align: 'center', width: W });

      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

async function generateCertificate(user, event) {
  const filePath = await generateCertificatePDF(user, event);
  await createCertificateRecord(event.id, user.id, filePath);
  return filePath;
}

async function generateSingleCertificate(user, event) {
  return generateCertificate(user, event);
}

async function bulkGenerateCertificates(attendees, event) {
  const results = [];
  for (const user of attendees) {
    try {
      const filePath = await generateCertificate(user, event);
      results.push({ user, filePath, success: true });
      console.log(`[CERT] Generated for ${user.full_name}`);
    } catch (err) {
      console.error(`[CERT] Failed for ${user.full_name}:`, err.message);
      results.push({ user, error: err.message, success: false });
    }
  }
  return results;
}

module.exports = { generateCertificate, generateSingleCertificate, bulkGenerateCertificates };
