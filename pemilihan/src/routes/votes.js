const express = require('express');
const router = express.Router();
const { db } = require('../db');

/**
 * POST /api/votes
 * Aturan Transaksional & Anonimitas Ketat:
 * 1. Pastikan status pemilihan adalah 'open'
 * 2. Pastikan candidate_id valid & aktif
 * 3. Pastikan PC memiliki sesi aktif dengan status 'ready' atau 'in_progress'
 * 4. Jalankan SQLite Transaction (Atomic Commit)
 * 5. Update status sesi PC menjadi 'completed'
 * 6. Masukkan suara ke tabel votes TANPA relasi ke PC atau identitas pemilih
 * 7. Tidak membocorkan pilihan calon dalam respons HTTP
 */
router.post('/', (req, res) => {
  const { pc_id, candidate_id } = req.body;

  if (!pc_id || !candidate_id) {
    return res.status(400).json({
      success: false,
      message: 'Parameter tidak lengkap.'
    });
  }

  // 1. Cek status pemilihan
  const statusRow = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get();
  if (!statusRow || statusRow.value !== 'open') {
    return res.status(403).json({
      success: false,
      message: 'Pemilihan suara belum dibuka atau sedang dijeda/ditutup.'
    });
  }

  // 2. Cek kandidat valid
  const candidate = db.prepare('SELECT id FROM candidates WHERE id = ? AND is_active = 1').get(candidate_id);
  if (!candidate) {
    return res.status(400).json({
      success: false,
      message: 'Kandidat yang dipilih tidak valid.'
    });
  }

  // 3. Cek PC terdaftar dan aktif
  const pc = db.prepare('SELECT id, is_enabled FROM pc_devices WHERE id = ?').get(pc_id);
  if (!pc || pc.is_enabled !== 1) {
    return res.status(403).json({
      success: false,
      message: 'Perangkat PC ini tidak diizinkan atau dinonaktifkan.'
    });
  }

  // Eksekusi transaksi SQLite
  const submitVoteTransaction = db.transaction(() => {
    // Kunci / verifikasi sesi aktif PC terkini
    const latestSession = db.prepare(`
      SELECT id, session_status
      FROM pc_sessions
      WHERE pc_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(pc_id);

    if (!latestSession) {
      throw new Error('Tidak ada sesi yang disiapkan untuk PC ini.');
    }

    if (latestSession.session_status === 'completed') {
      throw new Error('Sesi untuk PC ini sudah selesai memilih. Harap tunggu panitia menyiapkan sesi berikutnya.');
    }

    // Update status sesi PC menjadi completed
    const updateResult = db.prepare(`
      UPDATE pc_sessions
      SET session_status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND session_status != 'completed'
    `).run(latestSession.id);

    if (updateResult.changes === 0) {
      throw new Error('Terjadi konflik sesi atau suara telah tercatat sebelumnya (double submit dicegah).');
    }

    // Masukkan suara murni: HANYA candidate_id & recorded_at
    // DILARANG: mencatat pc_id, IP, atau session_id
    db.prepare(`
      INSERT INTO votes (candidate_id, recorded_at)
      VALUES (?, CURRENT_TIMESTAMP)
    `).run(candidate_id);

    return true;
  });

  try {
    submitVoteTransaction();

    // Catatan: Response HTTP TIDAK membocorkan kandidat yang dipilih demi anonimitas
    return res.json({
      success: true,
      message: 'Suara Anda telah berhasil dicatat oleh sistem secara aman dan anonim.'
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Gagal memproses suara. Silakan hubungi panitia.'
    });
  }
});

module.exports = router;
