const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireOrganizer } = require('../middleware/role');
const { getEventById, getRegistrationCount, getAttendanceCount, getEventCertificates, getEventRegistrations, getEventAttendance } = require('../db/queries');
const { queryOne, queryAll } = require('../db/database');

const router = express.Router();

// GET /api/reports/overall
router.get('/overall', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const totalEventsRow = await queryOne('SELECT COUNT(*) as count FROM events');
    const totalEvents = totalEventsRow ? totalEventsRow.count : 0;
    
    const totalRegistrationsRow = await queryOne('SELECT COUNT(*) as count FROM registrations');
    const totalRegistrations = totalRegistrationsRow ? totalRegistrationsRow.count : 0;
    
    const totalStudentsRow = await queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const totalStudents = totalStudentsRow ? totalStudentsRow.count : 0;
    
    const totalUsersRow = await queryOne('SELECT COUNT(*) as count FROM users');
    const totalUsers = totalUsersRow ? totalUsersRow.count : 0;
    
    const emailsSentRow = await queryOne("SELECT COUNT(*) as count FROM email_log WHERE status = 'sent'");
    const emailsSent = emailsSentRow ? emailsSentRow.count : 0;

    const topEvents = await queryAll(`
      SELECT e.id, e.title, e.event_date,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') as registration_count
      FROM events e ORDER BY registration_count DESC LIMIT 5
    `);

    const recentEvents = await queryAll(`
      SELECT e.*, u.full_name as organizer_name,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') as registration_count
      FROM events e LEFT JOIN users u ON e.organizer_id = u.id
      ORDER BY e.created_at DESC LIMIT 10
    `);

    res.json({
      data: { totalEvents, totalRegistrations, totalStudents, totalUsers, emailsSent, topEvents, recentEvents },
      message: 'OK'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report', detail: err.message });
  }
});

// GET /api/reports/events/:id
router.get('/events/:id', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const registrations_count = await getRegistrationCount(eventId);
    const attendance_count = await getAttendanceCount(eventId);
    const certificates = await getEventCertificates(eventId);
    const certificates_sent = certificates.filter(c => c.sent_via_email).length;
    const attendance_rate = registrations_count > 0 ? Math.round((attendance_count / registrations_count) * 100) : 0;

    res.json({
      data: { event, registrations_count, attendance_count, attendance_rate, certificates_sent, certificates_total: certificates.length },
      message: 'OK'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate event report', detail: err.message });
  }
});

// GET /api/reports/export/:id — CSV
router.get('/export/:id', authenticateToken, requireOrganizer, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const event = await getEventById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const registrants = await getEventRegistrations(eventId);
    const attendance = await getEventAttendance(eventId);
    const attendanceMap = {};
    for (const a of attendance) attendanceMap[a.user_id] = { checked_in_at: a.checked_in_at, method: a.method };

    let csv = 'Student ID,Full Name,Email,Department,Year Level,Registered At,Attended,Check-in Time,Method\n';
    for (const r of registrants) {
      const att = attendanceMap[r.user_id];
      csv += `"${r.student_id || ''}","${r.full_name}","${r.email}","${r.department || ''}","${r.year_level || ''}","${r.registered_at}","${att ? 'Yes' : 'No'}","${att ? att.checked_in_at : ''}","${att ? att.method : ''}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="event_${eventId}_report.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export report', detail: err.message });
  }
});

module.exports = router;
