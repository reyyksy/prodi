const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { hashPassword } = require('./auth');
const defaultCandidates = require('../config/paslon');
const siteConfig = require('../config/site');

// Direktori data persisten cross-platform
const dataDir = path.resolve(__dirname, '..', 'data');
const backupsDir = path.resolve(__dirname, '..', 'backups');
const exportsDir = path.resolve(__dirname, '..', 'exports');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

const dbPath = path.join(dataDir, 'election.sqlite');

let SQL_ENGINE = null;
let rawDb = null;
let _inTransaction = false; // Flag: true saat di dalam db.transaction() callback

// Wrapper helper agar API tetap kompatibel: prepare(sql).get(...), .all(...), .run(...)
const db = {
  exec(sql) {
    if (!rawDb) throw new Error('Database belum diinisialisasi.');
    rawDb.run(sql);
    this.saveToDisk();
  },

  saveToDisk() {
    try {
      if (rawDb) {
        const binary = rawDb.export();
        const buffer = Buffer.from(binary);
        fs.writeFileSync(dbPath, buffer);
      }
    } catch (err) {
      console.error('[DB] Gagal menyimpan database ke disk:', err);
    }
  },

  backup(targetFilePath) {
    if (!rawDb) throw new Error('Database belum diinisialisasi.');
    const binary = rawDb.export();
    const buffer = Buffer.from(binary);
    fs.writeFileSync(targetFilePath, buffer);
  },

  prepare(sql) {
    return {
      get(...params) {
        if (!rawDb) throw new Error('Database belum diinisialisasi.');
        const normalizedParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        const stmt = rawDb.prepare(sql);
        try {
          if (normalizedParams.length > 0) stmt.bind(normalizedParams);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },

      all(...params) {
        if (!rawDb) throw new Error('Database belum diinisialisasi.');
        const normalizedParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        const stmt = rawDb.prepare(sql);
        const rows = [];
        try {
          if (normalizedParams.length > 0) stmt.bind(normalizedParams);
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      },

      run(...params) {
        if (!rawDb) throw new Error('Database belum diinisialisasi.');
        const normalizedParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        try {
          rawDb.run(sql, normalizedParams);
          // Hanya simpan ke disk jika TIDAK sedang di dalam transaction callback
          // Supaya tidak memicu auto-commit yang merusak COMMIT utama
          if (!_inTransaction) {
            db.saveToDisk();
          }
          return {
            changes: rawDb.getRowsModified()
          };
        } catch (e) {
          throw e;
        }
      }
    };
  },

  transaction(fn) {
    return (...args) => {
      _inTransaction = true;
      rawDb.run('BEGIN TRANSACTION;');
      try {
        const result = fn(...args);
        rawDb.run('COMMIT;');
        _inTransaction = false;
        db.saveToDisk(); // Simpan sekali saja setelah COMMIT berhasil
        return result;
      } catch (err) {
        _inTransaction = false;
        try { rawDb.run('ROLLBACK;'); } catch (e) {}
        throw err;
      }
    };
  }
};

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

async function initDatabase() {
  if (rawDb) return;

  SQL_ENGINE = await initSqlJs();

  // Load existing file if present, else create new
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      rawDb = new SQL_ENGINE.Database(fileBuffer);
    } catch (e) {
      console.warn('[DB] Membaca file sqlite gagal, membuat database baru:', e.message);
      rawDb = new SQL_ENGINE.Database();
    }
  } else {
    rawDb = new SQL_ENGINE.Database();
  }

  // Schema creation
  rawDb.run(`
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

    CREATE TABLE IF NOT EXISTS pc_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pc_id INTEGER NOT NULL,
      session_token TEXT UNIQUE,
      session_status TEXT NOT NULL,
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

  // Settings inisialisasi
  const initSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  initSetting.run('election_status', 'draft');
  initSetting.run('election_title', siteConfig.electionTitle);
  initSetting.run('school_name', siteConfig.schoolName);
  initSetting.run('academic_year', siteConfig.academicYear);

  // Default admin (admin / admin)
  const adminUser = process.env.ADMIN_DEFAULT_USER || 'admin';
  const adminPass = process.env.ADMIN_DEFAULT_PASS || 'admin';
  const existingAdmin = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(adminUser);
  if (!existingAdmin) {
    const hashed = hashPassword(adminPass);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(adminUser, hashed);
  } else if (process.env.ADMIN_DEFAULT_PASS) {
    // .env adalah sumber konfigurasi password admin saat server diinisialisasi ulang.
    const hashed = hashPassword(adminPass);
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(hashed, adminUser);
  }

  // PC 1 - PC 5
  const countPc = db.prepare('SELECT COUNT(*) as cnt FROM pc_devices').get()?.cnt || 0;
  if (countPc === 0) {
    const insertPc = db.prepare('INSERT INTO pc_devices (pc_number, display_name, configured_ip, is_enabled) VALUES (?, ?, ?, 1)');
    for (let i = 1; i <= 5; i++) {
      insertPc.run(i, `PC Pemilih ${i}`, `192.168.1.${10 + i}`);
    }
  }

  // Pastikan ada pc_sessions aktif
  const pcs = db.prepare('SELECT id FROM pc_devices').all();
  const checkSession = db.prepare('SELECT id FROM pc_sessions WHERE pc_id = ? ORDER BY id DESC LIMIT 1');
  const createSession = db.prepare('INSERT INTO pc_sessions (pc_id, session_status) VALUES (?, ?)');
  for (const pc of pcs) {
    const sess = checkSession.get(pc.id);
    if (!sess) {
      createSession.run(pc.id, 'ready');
    }
  }

  // Candidates
  const countCand = db.prepare('SELECT COUNT(*) as cnt FROM candidates').get()?.cnt || 0;
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
  } else {
    // Sinkronkan identitas dan visi-misi dari konfigurasi terbaru tanpa menghapus suara.
    const updateCand = db.prepare(`
      UPDATE candidates SET chair_name = ?, vice_name = ?, vision = ?, mission = ?, programs_json = ?, photo_path = ?
      WHERE ballot_number = ?
    `);
    for (const c of defaultCandidates) {
      updateCand.run(c.chair_name, c.vice_name, c.vision, c.mission, JSON.stringify(c.programs || []), c.photo_path, c.ballot_number);
    }
  }

  // Snapshot cache
  const cacheRow = db.prepare("SELECT value FROM settings WHERE key = 'public_stats_cache'").get();
  if (!cacheRow) {
    snapshotPublicStats('init');
  }

  db.saveToDisk();
}

module.exports = {
  db,
  dbPath,
  backupsDir,
  exportsDir,
  initDatabase,
  calculateCurrentStats,
  snapshotPublicStats
};
