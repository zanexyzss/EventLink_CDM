const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { createCertificateRecord } = require('../db/queries');

// Cloud-compatible Puppeteer launch options
function getPuppeteerOptions() {
  const opts = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--single-process',
      '--no-zygote'
    ]
  };
  // If PUPPETEER_EXECUTABLE_PATH is set (e.g. on Render), use it
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  return opts;
}

const CERT_DIR = path.join(__dirname, '../../../assets/certificates');
if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

function getCertificateHTML(user, event, options = {}) {
  const eventDate = new Date(String(event.event_date).replace(' ', 'T'));
  const formattedDate = !isNaN(eventDate.getTime())
    ? eventDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : event.event_date;

  const institutionName = options.institution || 'Colegio de Montalban';
  const issuedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const certId = 'CDM-' + (event.id || '0') + '-' + (user.id || '0') + '-' + Date.now().toString(36).toUpperCase();

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=Inter:wght@300;400;500;600;700&family=Great+Vibes&display=swap");' +
    '*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }' +
    'html, body { width: 100%; height: 100%; overflow: hidden; background: #fff; }' +
    '.page { width: 100%; height: 100%; position: relative; background: linear-gradient(160deg, #fffef7 0%, #fefcf0 30%, #fffdf5 60%, #fefaed 100%); font-family: "Inter", sans-serif; overflow: hidden; }' +
    '.border-gold { position: absolute; inset: 16px; border: 3px solid #c9a84c; pointer-events: none; }' +
    '.border-inner { position: absolute; inset: 24px; border: 1px solid rgba(180,145,60,0.3); pointer-events: none; }' +
    '.corner { position: absolute; width: 80px; height: 80px; pointer-events: none; }' +
    '.corner svg { width: 100%; height: 100%; }' +
    '.c-tl { top: 20px; left: 20px; }' +
    '.c-tr { top: 20px; right: 20px; transform: scaleX(-1); }' +
    '.c-bl { bottom: 20px; left: 20px; transform: scaleY(-1); }' +
    '.c-br { bottom: 20px; right: 20px; transform: scale(-1,-1); }' +
    '.accent-left, .accent-right { position: absolute; top: 50%; width: 3px; height: 200px; transform: translateY(-50%); pointer-events: none; }' +
    '.accent-left { left: 40px; background: linear-gradient(to bottom, transparent, #c9a84c 30%, #c9a84c 70%, transparent); }' +
    '.accent-right { right: 40px; background: linear-gradient(to bottom, transparent, #c9a84c 30%, #c9a84c 70%, transparent); }' +
    '.institution-banner { text-align: center; padding-top: 50px; margin-bottom: 6px; }' +
    '.institution-name { font-family: "Inter", sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; color: #8b7332; }' +
    '.cert-title-block { text-align: center; margin-bottom: 8px; }' +
    '.cert-of { font-family: "Inter", sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 8px; text-transform: uppercase; color: #999; }' +
    '.cert-main-title { font-family: "Playfair Display", serif; font-size: 56px; font-weight: 700; color: #1a1a2e; line-height: 1.1; }' +
    '.gold-divider { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 10px auto 14px; width: 420px; }' +
    '.gold-divider .line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, #c9a84c, transparent); }' +
    '.gold-divider .diamond { width: 8px; height: 8px; background: #c9a84c; transform: rotate(45deg); flex-shrink: 0; }' +
    '.presented-to { text-align: center; font-family: "Inter", sans-serif; font-size: 11px; font-weight: 400; letter-spacing: 5px; text-transform: uppercase; color: #aaa; margin-bottom: 8px; }' +
    '.recipient { text-align: center; margin-bottom: 4px; }' +
    '.recipient-name { font-family: "Great Vibes", cursive; font-size: 52px; font-weight: 400; color: #1a1a2e; line-height: 1.2; }' +
    '.name-underline { width: 380px; height: 2px; margin: 2px auto 16px; background: linear-gradient(90deg, transparent, #c9a84c 20%, #c9a84c 80%, transparent); }' +
    '.description { text-align: center; font-family: "Inter", sans-serif; font-size: 13px; font-weight: 400; color: #666; line-height: 1.9; max-width: 560px; margin: 0 auto 20px; }' +
    '.description .event-title { font-weight: 700; color: #1a1a2e; font-size: 14px; }' +
    '.description .event-date { font-weight: 600; color: #8b7332; }' +
    '.description .event-venue { font-weight: 500; color: #555; }' +
    '.footer-area { position: absolute; bottom: 44px; left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 80px; }' +
    '.sig-block { text-align: center; width: 200px; }' +
    '.sig-line { width: 170px; height: 1px; background: #333; margin: 0 auto 6px; }' +
    '.sig-role { font-family: "Inter", sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #888; }' +
    '.sig-name-text { font-family: "Inter", sans-serif; font-size: 10px; font-weight: 500; color: #555; margin-top: 2px; }' +
    '.seal-area { text-align: center; }' +
    '.seal { width: 72px; height: 72px; border: 2px solid #c9a84c; border-radius: 50%; margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #fef9e7 0%, #fdf2d5 100%); }' +
    '.seal-inner { width: 56px; height: 56px; border: 1px solid rgba(180,145,60,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; }' +
    '.seal-icon { font-size: 22px; line-height: 1; }' +
    '.seal-text { font-family: "Inter", sans-serif; font-size: 5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #8b7332; margin-top: 1px; }' +
    '.footer-system { font-family: "Inter", sans-serif; font-size: 8px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #bbb; }' +
    '.footer-issued { font-family: "Inter", sans-serif; font-size: 7px; font-weight: 400; color: #ccc; margin-top: 2px; }' +
    '.cert-id { position: absolute; bottom: 28px; right: 42px; font-family: "Inter", sans-serif; font-size: 7px; font-weight: 400; color: #ccc; letter-spacing: 1px; }' +
    '</style></head><body>' +
    '<div class="page">' +
    '<div class="border-gold"></div>' +
    '<div class="border-inner"></div>' +
    '<div class="corner c-tl"><svg viewBox="0 0 80 80"><path d="M2,2 L30,2 L30,5 L5,5 L5,30 L2,30 Z" fill="#c9a84c"/><path d="M2,2 L18,2 L18,4 L4,4 L4,18 L2,18 Z" fill="rgba(180,145,60,0.4)"/><circle cx="8" cy="8" r="2" fill="rgba(180,145,60,0.3)"/></svg></div>' +
    '<div class="corner c-tr"><svg viewBox="0 0 80 80"><path d="M2,2 L30,2 L30,5 L5,5 L5,30 L2,30 Z" fill="#c9a84c"/><path d="M2,2 L18,2 L18,4 L4,4 L4,18 L2,18 Z" fill="rgba(180,145,60,0.4)"/><circle cx="8" cy="8" r="2" fill="rgba(180,145,60,0.3)"/></svg></div>' +
    '<div class="corner c-bl"><svg viewBox="0 0 80 80"><path d="M2,2 L30,2 L30,5 L5,5 L5,30 L2,30 Z" fill="#c9a84c"/><path d="M2,2 L18,2 L18,4 L4,4 L4,18 L2,18 Z" fill="rgba(180,145,60,0.4)"/><circle cx="8" cy="8" r="2" fill="rgba(180,145,60,0.3)"/></svg></div>' +
    '<div class="corner c-br"><svg viewBox="0 0 80 80"><path d="M2,2 L30,2 L30,5 L5,5 L5,30 L2,30 Z" fill="#c9a84c"/><path d="M2,2 L18,2 L18,4 L4,4 L4,18 L2,18 Z" fill="rgba(180,145,60,0.4)"/><circle cx="8" cy="8" r="2" fill="rgba(180,145,60,0.3)"/></svg></div>' +
    '<div class="accent-left"></div>' +
    '<div class="accent-right"></div>' +
    '<div class="institution-banner"><div class="institution-name">' + institutionName + '</div></div>' +
    '<div class="cert-title-block"><div class="cert-of">Certificate of</div><div class="cert-main-title">Completion</div></div>' +
    '<div class="gold-divider"><div class="line"></div><div class="diamond"></div><div class="line"></div></div>' +
    '<div class="presented-to">This is proudly presented to</div>' +
    '<div class="recipient"><div class="recipient-name">' + user.full_name + '</div></div>' +
    '<div class="name-underline"></div>' +
    '<div class="description">For the successful completion of the<br><span class="event-title">' + event.title + '</span><br>held on <span class="event-date">' + formattedDate + '</span>' + (event.venue ? ' at <span class="event-venue">' + event.venue + '</span>' : '') + '.</div>' +
    '<div class="footer-area">' +
    '<div class="sig-block"><div class="sig-line"></div><div class="sig-role">Event Organizer</div><div class="sig-name-text">' + (event.organizer_name || 'Event Committee') + '</div></div>' +
    '<div class="seal-area"><div class="seal"><div class="seal-inner"><div class="seal-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="#c9a84c"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg></div><div class="seal-text">Verified</div></div></div><div class="footer-system">EventLink CDM</div><div class="footer-issued">Issued ' + issuedDate + '</div></div>' +
    '<div class="sig-block"><div class="sig-line"></div><div class="sig-role">Administrator</div><div class="sig-name-text">System Administrator</div></div>' +
    '</div>' +
    '<div class="cert-id">ID: ' + certId + '</div>' +
    '</div>' +
    '</body></html>';
}

async function generateCertificate(user, event) {
  const browser = await puppeteer.launch(getPuppeteerOptions());
  const page = await browser.newPage();
  await page.setContent(getCertificateHTML(user, event), { waitUntil: 'networkidle0', timeout: 15000 });
  await page.setViewport({ width: 1122, height: 794 });

  const safeName = user.full_name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `cert_${event.id}_${user.id}_${safeName}.pdf`;
  const filePath = path.join(CERT_DIR, filename);

  await page.pdf({
    path: filePath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await browser.close();

  // Upsert certificate record
  await createCertificateRecord(event.id, user.id, filePath);

  return filePath;
}

async function generateSingleCertificate(user, event) {
  return generateCertificate(user, event);
}

async function bulkGenerateCertificates(attendees, event) {
  const results = [];
  // Reuse a single browser for performance
  const browser = await puppeteer.launch(getPuppeteerOptions());

  for (const user of attendees) {
    try {
      const page = await browser.newPage();
      await page.setContent(getCertificateHTML(user, event), { waitUntil: 'networkidle0', timeout: 15000 });
      await page.setViewport({ width: 1122, height: 794 });

      const safeName = user.full_name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `cert_${event.id}_${user.id}_${safeName}.pdf`;
      const filePath = path.join(CERT_DIR, filename);

      await page.pdf({
        path: filePath,
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      await page.close();

      await createCertificateRecord(event.id, user.id, filePath);

      results.push({ user, filePath, success: true });
      console.log(`[CERT] Generated for ${user.full_name}`);
    } catch (err) {
      console.error(`[CERT] Failed for ${user.full_name}:`, err.message);
      results.push({ user, error: err.message, success: false });
    }
  }

  await browser.close();
  return results;
}

module.exports = { generateCertificate, generateSingleCertificate, bulkGenerateCertificates, CERT_DIR };
