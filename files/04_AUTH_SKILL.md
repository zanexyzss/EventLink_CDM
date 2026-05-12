---
name: auth
agent: AUTH_AGENT
role: JWT authentication, login, register, role-based middleware
runs: STEP 3
depends_on: DATABASE_AGENT
---

# AUTH AGENT — EVENTLINK CDM

You build the complete authentication system. Every other backend route depends on your middleware. Build it complete — no stubs.

## FILES YOU MUST CREATE

### `electron/server/middleware/auth.js`
```javascript
const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
```

### `electron/server/middleware/role.js`
```javascript
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// Convenience exports
const requireAdmin = requireRole('admin');
const requireOrganizer = requireRole('admin', 'organizer');
const requireStudent = requireRole('admin', 'organizer', 'student');

module.exports = { requireRole, requireAdmin, requireOrganizer, requireStudent };
```

### `electron/server/routes/auth.js`
```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUserByEmail, createUser, getUserById } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = getUserByEmail(email);
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
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { full_name, email, password, student_id, department, year_level } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  const existing = getUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const password_hash = await bcrypt.hash(password, 10);
  const user = createUser({ full_name, email, password_hash, student_id, department, year_level, role: 'student' });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const { password_hash: _, ...safeUser } = user;
  res.status(201).json({ token, user: safeUser });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password_hash, ...safeUser } = user;
  res.json(safeUser);
});

module.exports = router;
```

### `src/store/authStore.js` (Zustand)
```javascript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        set({ user: data.user, token: data.token, isAuthenticated: true });
        return data.user;
      },

      register: async (formData) => {
        const { data } = await api.post('/auth/register', formData);
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        set({ user: data.user, token: data.token, isAuthenticated: true });
        return data.user;
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, isAuthenticated: false });
      },

      restoreToken: () => {
        const { token } = get();
        if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    }),
    { name: 'eventlink-auth', partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
);
```

### `src/lib/api.js`
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Response interceptor: auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('eventlink-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

### `src/components/ProtectedRoute.jsx`
```jsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles.length && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
```

## TOKEN PAYLOAD STRUCTURE
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "student",
  "full_name": "Juan dela Cruz",
  "iat": 1711234567,
  "exp": 1711839367
}
```

## VALIDATION CHECKLIST
- [ ] Login returns token + user (no password_hash)
- [ ] Register validates required fields and checks duplicate email
- [ ] `/me` endpoint works with valid token
- [ ] 401 on missing token, 403 on invalid token, 403 on wrong role
- [ ] Zustand store persists token to localStorage
- [ ] `restoreToken()` called on app startup

## HANDOFF
Signal: **BACKEND_AGENT, EMAIL_AGENT, CERTIFICATE_AGENT, QR_AGENT may now begin in parallel.**
Exports: `authenticateToken`, `requireAdmin`, `requireOrganizer`, `requireStudent`, `useAuthStore`
