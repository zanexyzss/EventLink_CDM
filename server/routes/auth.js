const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUserByEmail, createUser, getUserById } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Login failed. Please try again later.', detail: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password, student_id, department, year_level } = req.body;

    // --- Field-level validation ---
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (full_name.trim().length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters' });
    }
    if (!/^[a-zA-ZñÑ\s]+$/.test(full_name)) {
      return res.status(400).json({ error: 'Full name must contain only letters (no numbers or symbols)' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (student_id && !/^\d{2}-\d{5}$/.test(student_id)) {
      return res.status(400).json({ error: 'Student ID must follow the format 00-00000 (e.g. 24-12345)' });
    }

    if (year_level !== undefined && year_level !== null && year_level !== '') {
      const yl = Number(year_level);
      if (isNaN(yl) || yl < 1 || yl > 4) {
        return res.status(400).json({ error: 'Year level must be between 1 and 4' });
      }
    }

    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const user = await createUser({ full_name, email, password_hash, student_id, department, year_level, role: 'student' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password_hash: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed. Please try again later.', detail: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', detail: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await getUserByEmail(email);
    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return res.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    const { runSql } = require('../db/database');
    const { sendPasswordResetEmail } = require('../services/emailService');
    const crypto = require('crypto');

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await runSql(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt.toISOString()]
    );

    await sendPasswordResetEmail(user, token);

    res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('[AUTH] Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { queryOne, runSql } = require('../db/database');
    const now = new Date().toISOString();

    const resetRecord = await queryOne(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?',
      [token, now]
    );

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    
    // Update password
    await runSql('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, resetRecord.user_id]);
    
    // Mark token as used
    await runSql('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [resetRecord.id]);

    res.json({ message: 'Password has been successfully reset. You can now login.' });
  } catch (err) {
    console.error('[AUTH] Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
