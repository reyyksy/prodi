const express = require('express');
const router = express.Router();
const { db, calculateCurrentStats, snapshotPublicStats } = require('../db');

// GET /api/public/election-status
router.get('/election-status', (req, res) => {
  try {
    const statusRow = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get();
    const titleRow = db.prepare("SELECT value FROM settings WHERE key = 'election_title'").get();
    const schoolRow = db.prepare("SELECT value FROM settings WHERE key = 'school_name'").get();
    const yearRow = db.prepare("SELECT value FROM settings WHERE key = 'academic_year'").get();

    res.json({
      success: true,
      data: {
        status: statusRow ? statusRow.value : 'draft',
        title: titleRow ? titleRow.value : '',
        school_name: schoolRow ? schoolRow.value : '',
        academic_year: yearRow ? yearRow.value : ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat status pemilihan' });
  }
});

// GET /api/candidates
router.get('/candidates', (req, res) => {
  try {
    const candidates = db.prepare(`
      SELECT id, ballot_number, chair_name, vice_name, vision, mission, programs_json, photo_path
      FROM candidates
      WHERE is_active = 1
      ORDER BY ballot_number ASC
    `).all();

    const formatted = candidates.map(c => ({
      ...c,
      programs: JSON.parse(c.programs_json || '[]')
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat data kandidat' });
  }
});

// GET /api/statistics
// Sesuai revisi: Jika pemilihan sedang OPEN/PAUSED/DRAFT, data hasil perolehan diambil dari SNAPSHOT sistem berjangka (15 menit).
// Merefresh browser TIDAK mengubah data hasil sampai interval sistem tiba atau panitia menekan manual update.
// Jika status CLOSED (final), otomatis menghasilkan data final terkini secara deterministik.
router.get('/statistics', (req, res) => {
  try {
    const statusRow = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get();
    const currentStatus = statusRow ? statusRow.value : 'draft';

    const lastUpdatedRow = db.prepare("SELECT value FROM settings WHERE key = 'public_stats_last_updated'").get();
    const nextUpdateRow = db.prepare("SELECT value FROM settings WHERE key = 'public_stats_next_update'").get();
    const cacheRow = db.prepare("SELECT value FROM settings WHERE key = 'public_stats_cache'").get();

    let statsData;
    let lastUpdated;
    let nextUpdate;

    if (currentStatus === 'closed') {
      // Setelah ditutup, hasil final selalu membaca seluruh suara terkini.
      statsData = calculateCurrentStats();
      lastUpdated = new Date().toISOString();
      nextUpdate = null;
    } else {
      const now = Date.now();
      const cacheNext = nextUpdateRow ? new Date(nextUpdateRow.value).getTime() : 0;
      if (!cacheRow || !lastUpdatedRow || !cacheNext || now >= cacheNext) {
        const snapshot = snapshotPublicStats('scheduled');
        statsData = snapshot.stats;
        lastUpdated = snapshot.last_updated;
        nextUpdate = snapshot.next_update;
      } else {
        statsData = JSON.parse(cacheRow.value);
        lastUpdated = lastUpdatedRow.value;
        nextUpdate = nextUpdateRow.value;
      }
      // Status operasional harus selalu real-time meskipun jumlah suara masih snapshot.
      statsData = { ...statsData, election_status: currentStatus };
    }

    res.json({
      success: true,
      data: {
        ...statsData,
        last_updated: lastUpdated,
        next_update: nextUpdate,
        server_time: new Date().toISOString(),
        server_running: true
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat statistik' });
  }
});

// POST /api/public/statistics/refresh - Pembaruan berkala terpicu oleh sistem / tombol manual resmi
router.post('/statistics/refresh', (req, res) => {
  try {
    const snapshot = snapshotPublicStats('manual_trigger');
    res.json({
      success: true,
      message: 'Statistik publik berhasil diperbarui dari data suara terkini.',
      data: {
        ...snapshot.stats,
        last_updated: snapshot.last_updated,
        next_update: snapshot.next_update,
        server_time: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui snapshot statistik' });
  }
});

// GET /api/public/pc-info - Mendeteksi identitas PC pemilih berdasarkan query pc_number atau IP
router.get('/pc-info', (req, res) => {
  try {
    const pcNum = req.query.pc ? parseInt(req.query.pc, 10) : null;
    let pc = null;
    if (pcNum) {
      pc = db.prepare('SELECT id, pc_number, display_name, is_enabled FROM pc_devices WHERE pc_number = ?').get(pcNum);
    }
    if (!pc) {
      pc = db.prepare('SELECT id, pc_number, display_name, is_enabled FROM pc_devices ORDER BY id ASC LIMIT 1').get();
    }

    const session = db.prepare(`
      SELECT id, session_status, started_at, completed_at
      FROM pc_sessions
      WHERE pc_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(pc.id);

    res.json({
      success: true,
      data: {
        pc,
        session: session || { session_status: 'ready' }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memeriksa status PC' });
  }
});

// POST /api/public/pc-start - Menandai sesi PC beralih ke 'in_progress' saat pemilih mulai berinteraksi
router.post('/pc-start', (req, res) => {
  try {
    const { pc_id } = req.body;
    if (!pc_id) return res.status(400).json({ success: false, message: 'ID PC wajib disertakan' });

    const latestSession = db.prepare(`
      SELECT id, session_status FROM pc_sessions WHERE pc_id = ? ORDER BY id DESC LIMIT 1
    `).get(pc_id);

    if (latestSession && latestSession.session_status === 'ready') {
      db.prepare("UPDATE pc_sessions SET session_status = 'in_progress' WHERE id = ?").run(latestSession.id);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui status sesi' });
  }
});

module.exports = router;
