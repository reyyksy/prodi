const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db, dbPath, backupsDir, exportsDir } = require('../db');
const { requireAuth } = require('./authRoutes');
const { hashPassword, verifyPassword } = require('../auth');
const { generateElectionExcel } = require('../services/excelService');
const defaultCandidates = require('../../config/paslon');

// Semua rute di bawah ini dilindungi requireAuth
router.use(requireAuth);

// GET /api/admin/overview - Ringkasan Dashboard
router.get('/overview', (req, res) => {
  try {
    const statusRow = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get();
    const titleRow = db.prepare("SELECT value FROM settings WHERE key = 'election_title'").get();
    const totalVotes = db.prepare('SELECT COUNT(*) as total FROM votes').get().total;
    const totalCandidates = db.prepare('SELECT COUNT(*) as total FROM candidates WHERE is_active = 1').get().total;

    // PC summaries
    const pcDevices = db.prepare(`
      SELECT p.id, p.pc_number, p.display_name, p.configured_ip, p.is_enabled,
             s.session_status, s.started_at, s.completed_at
      FROM pc_devices p
      LEFT JOIN pc_sessions s ON s.id = (
        SELECT id FROM pc_sessions WHERE pc_id = p.id ORDER BY id DESC LIMIT 1
      )
      ORDER BY p.pc_number ASC
    `).all();

    // Latest audit logs
    const recentLogs = db.prepare(`
      SELECT id, action, details, admin_username, ip_address, created_at
      FROM audit_logs
      ORDER BY id DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        election_status: statusRow ? statusRow.value : 'draft',
        election_title: titleRow ? titleRow.value : '',
        total_votes: totalVotes,
        total_candidates: totalCandidates,
        pc_devices: pcDevices,
        recent_logs: recentLogs
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil data overview: ' + err.message });
  }
});

// GET /api/admin/pc-devices - Daftar 5 PC Monitoring
router.get('/pc-devices', (req, res) => {
  try {
    const pcDevices = db.prepare(`
      SELECT p.id, p.pc_number, p.display_name, p.configured_ip, p.is_enabled,
             COALESCE(s.session_status, 'ready') as session_status,
             s.started_at, s.completed_at
      FROM pc_devices p
      LEFT JOIN pc_sessions s ON s.id = (
        SELECT id FROM pc_sessions WHERE pc_id = p.id ORDER BY id DESC LIMIT 1
      )
      ORDER BY p.pc_number ASC
    `).all();

    res.json({ success: true, data: pcDevices });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil status PC' });
  }
});

// POST /api/admin/pc-devices/:id/prepare-next-voter
// MUTLAK: Menyiapkan sesi berikutnya TIDAK BOLEH menghapus suara di tabel votes
router.post('/pc-devices/:id/prepare-next-voter', (req, res) => {
  try {
    const pcId = req.params.id;
    const pc = db.prepare('SELECT id, pc_number, display_name FROM pc_devices WHERE id = ?').get(pcId);
    if (!pc) {
      return res.status(404).json({ success: false, message: 'Perangkat PC tidak ditemukan' });
    }

    // Buat sesi baru berstatus 'ready'
    db.prepare(`
      INSERT INTO pc_sessions (pc_id, session_status, reset_by_admin_id)
      VALUES (?, 'ready', ?)
    `).run(pc.id, req.admin.id);

    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'PREPARE_NEXT_VOTER',
      `Menyiapkan pemilih berikutnya pada ${pc.display_name} (PC #${pc.pc_number})`,
      req.admin.username,
      req.ip
    );

    res.json({
      success: true,
      message: `Berhasil menyiapkan ${pc.display_name} untuk pemilih selanjutnya.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menyiapkan PC: ' + err.message });
  }
});

// GET /api/admin/candidates
router.get('/candidates', (req, res) => {
  try {
    const candidates = db.prepare('SELECT * FROM candidates ORDER BY ballot_number ASC').all();
    const formatted = candidates.map(c => ({
      ...c,
      programs: JSON.parse(c.programs_json || '[]')
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat kandidat' });
  }
});

// Kontrol Pemilihan: Start, Pause, Stop, Reset
// POST /api/admin/election/start
router.post('/election/start', (req, res) => {
  try {
    db.prepare("UPDATE settings SET value = 'open', updated_at = CURRENT_TIMESTAMP WHERE key = 'election_status'").run();

    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'ELECTION_START',
      'Pemilihan dibuka / dimulai.',
      req.admin.username,
      req.ip
    );

    res.json({ success: true, message: 'Pemilihan berhasil DIBUKA.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/election/pause
router.post('/election/pause', (req, res) => {
  try {
    db.prepare("UPDATE settings SET value = 'paused', updated_at = CURRENT_TIMESTAMP WHERE key = 'election_status'").run();

    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'ELECTION_PAUSE',
      'Pemilihan dihentikan sementara (DIJEDA).',
      req.admin.username,
      req.ip
    );

    res.json({ success: true, message: 'Pemilihan berhasil DIJEDA.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/election/stop (Tutup / Final) - Memerlukan konfirmasi password
router.post('/election/stop', (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Konfirmasi password diperlukan untuk menutup pemilihan.' });
    }

    const user = db.prepare('SELECT password_hash FROM admin_users WHERE id = ?').get(req.admin.id);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, message: 'Password salah. Aksi penutupan dibatalkan.' });
    }

    db.prepare("UPDATE settings SET value = 'closed', updated_at = CURRENT_TIMESTAMP WHERE key = 'election_status'").run();

    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'ELECTION_STOP',
      'Pemilihan DITUTUP secara final oleh admin.',
      req.admin.username,
      req.ip
    );

    res.json({ success: true, message: 'Pemilihan telah DITUTUP secara final.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/election/reset - Backup otomatis, butuh verifikasi kata sandi + frasa konfirmasi
router.post('/election/reset', async (req, res) => {
  try {
    const { password, confirmation_phrase } = req.body;

    if (confirmation_phrase !== 'RESET-PEMILIHAN-TJKT') {
      return res.status(400).json({
        success: false,
        message: 'Frasa konfirmasi salah. Harap ketik: RESET-PEMILIHAN-TJKT'
      });
    }

    const user = db.prepare('SELECT password_hash FROM admin_users WHERE id = ?').get(req.admin.id);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, message: 'Password salah.' });
    }

    // Backup database otomatis sebelum reset
    const backupFileName = `auto_backup_before_reset_${Date.now()}.sqlite`;
    const backupFilePath = path.join(backupsDir, backupFileName);
    await db.backup(backupFilePath);

    // Lakukan Reset Transaksional
    db.transaction(() => {
      // Hapus seluruh suara
      db.prepare('DELETE FROM votes').run();

      // Kembalikan status ke draft
      db.prepare("UPDATE settings SET value = 'draft', updated_at = CURRENT_TIMESTAMP WHERE key = 'election_status'").run();

      // Reset semua status sesi PC ke ready
      const pcs = db.prepare('SELECT id FROM pc_devices').all();
      for (const pc of pcs) {
        db.prepare("INSERT INTO pc_sessions (pc_id, session_status, reset_by_admin_id) VALUES (?, 'ready', ?)").run(pc.id, req.admin.id);
      }

      // Catat log
      db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
        'ELECTION_RESET',
        `Sistem pemilihan di-reset ke status draft. Backup tersimpan di: ${backupFileName}`,
        req.admin.username,
        req.ip
      );
    })();

    res.json({
      success: true,
      message: `Pemilihan berhasil di-reset. Data backup tersimpan di ${backupFileName}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal melakukan reset: ' + err.message });
  }
});

// GET /api/admin/settings & PATCH /api/admin/settings
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat pengaturan' });
  }
});

router.patch('/settings', (req, res) => {
  try {
    const { election_title, school_name, academic_year } = req.body;
    const update = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP');

    if (election_title !== undefined) update.run('election_title', election_title);
    if (school_name !== undefined) update.run('school_name', school_name);
    if (academic_year !== undefined) update.run('academic_year', academic_year);

    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'UPDATE_SETTINGS',
      'Pengaturan identitas pemilihan diperbarui',
      req.admin.username,
      req.ip
    );

    res.json({ success: true, message: 'Pengaturan berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan' });
  }
});

// POST /api/admin/password - Ubah Password
router.post('/password', (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password baru minimal harus 6 karakter.'
      });
    }

    const user = db.prepare('SELECT password_hash FROM admin_users WHERE id = ?').get(req.admin.id);
    if (!user || !verifyPassword(current_password, user.password_hash)) {
      return res.status(401).json({ success: false, message: 'Password lama tidak sesuai.' });
    }

    const newHashed = hashPassword(new_password);
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(newHashed, req.admin.id);

    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'CHANGE_PASSWORD',
      'Password akun admin berhasil diubah.',
      req.admin.username,
      req.ip
    );

    res.json({ success: true, message: 'Password berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui password' });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logs = db.prepare(`
      SELECT id, action, details, admin_username, ip_address, created_at
      FROM audit_logs
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat audit log' });
  }
});

// BACKUP & RESTORE
// POST /api/admin/backup
router.post('/backup', async (req, res) => {
  try {
    const filename = `manual_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
    const targetPath = path.join(backupsDir, filename);

    // SQLite Online Backup API
    await db.backup(targetPath);

    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'MANUAL_BACKUP',
      `Backup manual dibuat: ${filename}`,
      req.admin.username,
      req.ip
    );

    res.json({
      success: true,
      message: 'Backup database berhasil dibuat.',
      filename
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membuat backup: ' + err.message });
  }
});

// GET /api/admin/backups
router.get('/backups', (req, res) => {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.sqlite'))
      .map(f => {
        const stats = fs.statSync(path.join(backupsDir, f));
        return {
          filename: f,
          size: stats.size,
          created_at: stats.mtime
        };
      })
      .sort((a, b) => b.created_at - a.created_at);

    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat daftar backup' });
  }
});

// EKSPOR EXCEL (.xlsx)
// POST /api/admin/exports/generate
router.post('/exports/generate', async (req, res) => {
  try {
    const { filename, filePath } = await generateElectionExcel();

    db.prepare('INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)').run(
      'GENERATE_EXCEL',
      `Laporan Excel hasil pemilihan digenerate: ${filename}`,
      req.admin.username,
      req.ip
    );

    res.json({
      success: true,
      message: 'Laporan Excel berhasil dibuat.',
      filename
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membuat laporan Excel: ' + err.message });
  }
});

// GET /api/admin/exports
router.get('/exports', (req, res) => {
  try {
    const files = fs.readdirSync(exportsDir)
      .filter(f => f.endsWith('.xlsx'))
      .map(f => {
        const stats = fs.statSync(path.join(exportsDir, f));
        return {
          filename: f,
          size: stats.size,
          created_at: stats.mtime
        };
      })
      .sort((a, b) => b.created_at - a.created_at);

    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca daftar ekspor' });
  }
});

// GET /api/admin/exports/:filename/download
router.get('/exports/:filename/download', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const targetPath = path.join(exportsDir, filename);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).send('File laporan tidak ditemukan.');
    }

    res.download(targetPath, filename);
  } catch (err) {
    res.status(500).send('Gagal mengunduh file.');
  }
});

module.exports = router;
