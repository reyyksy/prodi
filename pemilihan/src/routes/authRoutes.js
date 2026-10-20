const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { verifyPassword, generateToken } = require('../auth');

// Rate limiting untuk proteksi brute force login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // Maksimal 10 percobaan per 15 menit
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login yang gagal. Silakan coba lagi setelah 15 menit.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
  }

  const user = db.prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    // Catat log gagal jika perlu (audit)
    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'LOGIN_FAILED',
      'Percobaan login gagal dengan username: ' + username,
      username,
      req.ip
    );
    return res.status(401).json({ success: false, message: 'Username atau password tidak sesuai.' });
  }

  // Buat sesi server-side (berlaku 12 jam)
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);

  // Set Cookie HttpOnly
  res.cookie('admin_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  });

  db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
    'LOGIN_SUCCESS',
    'Admin berhasil login ke sistem.',
    user.username,
    req.ip
  );

  res.json({
    success: true,
    message: 'Login berhasil.',
    user: { id: user.id, username: user.username }
  });
});

// Middleware autentikasi
function requireAuth(req, res, next) {
  const token = req.cookies.admin_session || req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Sesi login tidak ditemukan. Harap login kembali.' });
  }

  const session = db.prepare(`
    SELECT s.id, s.expires_at, u.id as user_id, u.username
    FROM sessions s
    JOIN admin_users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(token);

  if (!session) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid atau telah berakhir.' });
  }

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
    return res.status(401).json({ success: false, message: 'Sesi telah kedaluwarsa. Silakan login kembali.' });
  }

  req.admin = {
    id: session.user_id,
    username: session.username,
    sessionToken: session.id
  };
  next();
}

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.admin
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.admin.sessionToken);
  res.clearCookie('admin_session');

  db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
    'LOGOUT',
    'Admin telah keluar dari sesi.',
    req.admin.username,
    req.ip
  );

  res.json({ success: true, message: 'Berhasil keluar.' });
});

module.exports = {
  router,
  requireAuth
};
