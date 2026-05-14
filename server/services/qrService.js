const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const QR_DIR = path.join(__dirname, '../../../assets/qrcodes');
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

async function generateRegistrationQR(userId, eventId) {
  const payload = JSON.stringify({ userId, eventId, type: 'registration', ts: Date.now() });
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    width: 400,
    margin: 2,
    color: { dark: '#1e3a8a', light: '#ffffff' }
  });
}

async function generateQRDataURL(userId, eventId) {
  const payload = JSON.stringify({ userId, eventId, type: 'registration' });
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'H', width: 300, color: { dark: '#1e3a8a' } });
}

function parseQRPayload(rawString) {
  try {
    return JSON.parse(rawString);
  } catch {
    return null;
  }
}

module.exports = { generateRegistrationQR, generateQRDataURL, parseQRPayload };
