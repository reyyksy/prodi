const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { hashPassword } = require('./auth');
const defaultCandidates = require('../config/paslon');

// Pastikan direktori data, backups, exports ada di disk dengan path aman cross-platform
const dataDir = path.resolve(__dirname, '..', 'data');
const backupsDir = path.resolve(__dirname, '..', 'backups');
const exportsDir = path.resolve(__dirname, '..', 'exports');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

const dbPath = path.join(dataDir, 'election.sqlite');
const db = new Database(dbPath);

// Enable WAL mode & foreign keys for high performance and integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function calculateCurrentStats() {
  const statusRow = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get();
  const status = statusRow ? statusRow.value : 'draft';

  const totalVotesRow = db.prepare('SELECT COUNT(*) as total FROM votes').get();
  const totalVotes = totalVotesRow ? totalVotesRow.total : 0;

  const candidates = db.prepare(`
    SELECT c.id, c.ballot_number, c.chair_name, c.vice_name, c.photo_path,
           COUNT(v.id) as vote_count
    FROM candidates c
    LEFT JOIN votes v ON v.candidate_id = c.id
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.ballot_number ASC
  `).all();

  let maxVotes = -1;
  let winnerCandidates = [];

  const stats = candidates.map(c => {
    const percentage = totalVotes > 0 ? ((c.vote_count / totalVotes) * 100).toFixed(1) : '0.0';
    if (c.vote_count > maxVotes) {
      maxVotes = c.vote_count;
      winnerCandidates = [c.id];
    } else if (c.vote_count === maxVotes && maxVotes > 0) {
      winnerCandidates.push(c.id);
    }
    return {
      id: c.id,
      ballot_number: c.ballot_number,
      chair_name: c.chair_name,
      vice_name: c.vice_name,
      photo_path: c.photo_path,
      vote_count: c.vote_count,
      percentage: parseFloat(percentage)
    };
  });

  let resultStatus = 'in_progress';
  if (status === 'closed') {
    if (totalVotes === 0) {
      resultStatus = 'no_votes';
    } else if (winnerCandidates.length > 1) {
      resultStatus = 'tie';
    } else {
      resultStatus = 'decided';
    }
  }

  return {
    election_status: status,
    total_votes: totalVotes,
    candidates: stats,
    result_status: resultStatus,
    winner_candidate_ids: winnerCandidates
  };
}

function snapshotPublicStats(triggerType = 'scheduled') {
  const stats = calculateCurrentStats();
  const now = new Date();
  const snapshotJson = JSON.stringify(stats);
  const nextSnapshot = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  upsert.run('public_stats_cache', snapshotJson);
  upsert.run('public_stats_last_updated', now.toISOString());
  upsert.run('public_stats_next_update', nextSnapshot);

  return {
    stats,
    last_updated: now.toISOString(),
    next_update: nextSnapshot,
    triggerType
  };
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ballot_number INTEGER UNIQUE NOT NULL,
      chair_name TEXT NOT NULL,
      vice_name TEXT NOT NULL,
      vision TEXT NOT NULL,
      mission TEXT NOT NULL,
      programs_json TEXT NOT NULL,
      photo_path TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    -- DILARANG: Menyimpan nama pemilih, NIS, IP, pc_id, atau session_id
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pc_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pc_number INTEGER UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      configured_ip TEXT,
      is_enabled INTEGER DEFAULT 1
    );

    -- Sesi PC: Status sesi PC tanpa kandidat_id
    CREATE TABLE IF NOT EXISTS pc_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pc_id INTEGER NOT NULL,
      session_token TEXT UNIQUE,
      session_status TEXT NOT NULL CHECK(session_status IN ('ready', 'in_progress', 'completed')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      reset_by_admin_id INTEGER,
      FOREIGN KEY (pc_id) REFERENCES pc_devices(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      admin_username TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Inisialisasi default settings
  const initSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  initSetting.run('election_status', 'draft'); // draft, open, paused, closed
  initSetting.run('election_title', 'Pemilihan Ketua & Wakil Ketua Program Keahlian TJKT');
  initSetting.run('school_name', 'SMKS YASBAM KOTA BOGOR');
  initSetting.run('academic_year', '2026/2027');

  // Inisialisasi default admin (admin / admin) tanpa perlu .env khusus
  const adminUser = process.env.ADMIN_DEFAULT_USER || 'admin';
  const adminPass = process.env.ADMIN_DEFAULT_PASS || 'admin';
  const existingAdmin = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(adminUser);
  if (!existingAdmin) {
    const hashed = hashPassword(adminPass);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(adminUser, hashed);
  }

  // Inisialisasi PC 1 - PC 5
  const countPc = db.prepare('SELECT COUNT(*) as cnt FROM pc_devices').get().cnt;
  if (countPc === 0) {
    const insertPc = db.prepare('INSERT INTO pc_devices (pc_number, display_name, configured_ip, is_enabled) VALUES (?, ?, ?, 1)');
    for (let i = 1; i <= 5; i++) {
      insertPc.run(i, `PC Pemilih ${i}`, `192.168.1.${10 + i}`);
    }
  }

  // Pastikan setiap PC memiliki minimal 1 record pc_sessions aktif ('ready' atau sesuai state sebelumnya)
  const pcs = db.prepare('SELECT id FROM pc_devices').all();
  const checkSession = db.prepare('SELECT id FROM pc_sessions WHERE pc_id = ? ORDER BY id DESC LIMIT 1');
  const createSession = db.prepare('INSERT INTO pc_sessions (pc_id, session_status) VALUES (?, ?)');
  for (const pc of pcs) {
    const sess = checkSession.get(pc.id);
    if (!sess) {
      createSession.run(pc.id, 'ready');
    }
  }

  // Inisialisasi kandidat dari paslon.js jika kosong
  const countCand = db.prepare('SELECT COUNT(*) as cnt FROM candidates').get().cnt;
  if (countCand === 0) {
    const insertCand = db.prepare(`
      INSERT INTO candidates (ballot_number, chair_name, vice_name, vision, mission, programs_json, photo_path, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const c of defaultCandidates) {
      insertCand.run(
        c.ballot_number,
        c.chair_name,
        c.vice_name,
        c.vision,
        c.mission,
        JSON.stringify(c.programs || []),
        c.photo_path
      );
    }
  }

  // Inisialisasi snapshot statistik publik jika belum ada
  const cacheRow = db.prepare("SELECT value FROM settings WHERE key = 'public_stats_cache'").get();
  if (!cacheRow) {
    snapshotPublicStats('init');
  }
}

initSchema();

module.exports = {
  db,
  dbPath,
  backupsDir,
  exportsDir,
  calculateCurrentStats,
  snapshotPublicStats
};
