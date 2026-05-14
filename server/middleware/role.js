function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireOrganizer = requireRole('admin', 'organizer');
const requireStudent = requireRole('admin', 'organizer', 'student');

module.exports = { requireRole, requireAdmin, requireOrganizer, requireStudent };
