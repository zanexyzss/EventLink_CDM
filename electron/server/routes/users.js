const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const { getAllUsers, getUserById, updateUser, deleteUser } = require('../db/queries');
const { queryOne } = require('../db/database');

const router = express.Router();

// GET /api/users
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, search, limit = 20, offset = 0 } = req.query;
    const { users, total } = await getAllUsers({ role, search, limit: parseInt(limit), offset: parseInt(offset) });
    res.json({ data: users, total, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', detail: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await getUserById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...safeUser } = user;
    res.json({ data: safeUser, message: 'OK' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', detail: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const existing = await getUserById(userId);
    if (!existing) return res.status(404).json({ error: 'User not found' });
    const user = await updateUser(userId, req.body);
    const { password_hash, ...safeUser } = user;
    res.json({ data: safeUser, message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user', detail: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (userId === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

    const existing = await getUserById(userId);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    if (existing.role === 'admin') {
      const adminCountRow = await queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      const adminCount = adminCountRow ? adminCountRow.count : 0;
      if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }

    await deleteUser(userId);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', detail: err.message });
  }
});

module.exports = router;
