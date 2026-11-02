const express = require('express');
const crypto = require('crypto');
const { db } = require('../db');
const { verifyPassword } = require('../auth');

const router = express.Router();
const activeSessions = new Map();

function resetOnlineSessions() {
  activeSessions.clear();
}

router.post('/login', (req, res) => {
  const { identifier, username, password } = req.body || {};
  const loginName = String(identifier || username || '').trim();
  const client = db.prepare('SELECT id, username, password_hash, has_voted FROM online_clients WHERE LOWER(username) = LOWER(?) OR id = ?').get(loginName, loginName);
  if (!client || !verifyPassword(password || '', client.password_hash)) {
    return res.status(401).json({ success: false, message: 'ID, username, atau password salah.' });
  }
  if (client.has_voted) {
    return res.status(403).json({ success: false, message: 'Akun ini sudah tercatat memilih.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, client.id);
  res.json({ success: true, token, user: { id: client.id, username: client.username } });
});

router.get('/me', (req, res) => {
  const clientId = activeSessions.get(req.headers.authorization?.replace(/^Bearer\s+/i, ''));
  const client = clientId && db.prepare('SELECT id, username, has_voted FROM online_clients WHERE id = ?').get(clientId);
  res.json({ success: Boolean(client), user: client || null });
});

router.post('/vote', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const clientId = activeSessions.get(token);
  const { candidate_id } = req.body || {};
  if (!clientId || !candidate_id) return res.status(401).json({ success: false, message: 'Sesi online tidak valid.' });

  try {
    db.transaction(() => {
      const status = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get();
      if (!status || status.value !== 'open') throw new Error('Pemilihan sedang tidak dibuka.');
      const candidate = db.prepare('SELECT id FROM candidates WHERE id = ? AND is_active = 1').get(candidate_id);
      const client = db.prepare('SELECT has_voted FROM online_clients WHERE id = ?').get(clientId);
      if (!candidate || !client || client.has_voted) throw new Error('Akun sudah memilih atau kandidat tidak valid.');
      db.prepare("INSERT INTO votes (candidate_id, source, recorded_at) VALUES (?, 'online', CURRENT_TIMESTAMP)").run(candidate_id);
      db.prepare("UPDATE online_clients SET has_voted = 1, voted_at = CURRENT_TIMESTAMP WHERE id = ?").run(clientId);
    })();
    activeSessions.delete(token);
    res.json({ success: true, message: 'Suara online berhasil dicatat.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.resetOnlineSessions = resetOnlineSessions;
