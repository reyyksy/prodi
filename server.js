require('dotenv').config();
const express = require('express');
const path = require('path');
const os = require('os');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { db, initDatabase } = require('./src/db');
const publicRoutes = require('./src/routes/public');
const votesRoutes = require('./src/routes/votes');
const { router: authRouter } = require('./src/routes/authRoutes');
const adminRouter = require('./src/routes/admin');

const app = express();
// Default port 3000 jika .env tidak ada
const PORT = process.env.PORT || 3000;

// Catat waktu startup server di memori
const SERVER_START_TIME = new Date().toISOString();

// Fungsi deteksi IP lokal otomatis (Cross-platform Windows & Linux)
function getLocalIp() {
  let interfaces;
  try {
    interfaces = os.networkInterfaces();
  } catch (error) {
    console.warn('[NETWORK] Interface LAN tidak dapat dideteksi; memakai localhost:', error.message);
    return '127.0.0.1';
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Periksa IPv4 non-internal
      const isIpv4 = iface.family === 'IPv4' || iface.family === 4;
      if (isIpv4 && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // Fallback localhost
}

const SERVER_IP = getLocalIp();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

let wasRecoveredFromOpen = false;

// Jalankan inisialisasi async database (pure JS WebAssembly SQLite)
async function startServer() {
  try {
    await initDatabase();
    console.log('[DB] Database SQLite (sql.js WASM) berhasil dimuat tanpa C++ build.');

    // Perilaku server restart / pemadaman listrik (Bab 15 fixx.md):
    const statusRow = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get();
    if (statusRow && statusRow.value === 'open') {
      db.prepare("UPDATE settings SET value = 'paused', updated_at = CURRENT_TIMESTAMP WHERE key = 'election_status'").run();
      db.prepare("INSERT INTO audit_logs (action, details, admin_username, ip_address) VALUES (?, ?, ?, ?)").run(
        'SERVER_RESTART_RECOVERY',
        'Server baru menyala setelah restart/mati lampu: status sebelumnya "open" otomatis dialihkan ke "paused" demi keamanan.',
        'SYSTEM',
        '127.0.0.1'
      );
      wasRecoveredFromOpen = true;
      console.log('[SAFETY] Status pemilihan sebelumnya OPEN telah dialihkan ke PAUSED untuk pemulihan aman.');
    }
  } catch (e) {
    console.error('Inisialisasi database server gagal:', e);
  }

  // Endpoint health check & status operasional server
  app.get('/api/health', (req, res) => {
    try {
      const statusRow = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get();
      const electionStatus = statusRow ? statusRow.value : 'draft';

      const recentRecovery = db.prepare(`
        SELECT action, details, created_at
        FROM audit_logs
        WHERE action = 'SERVER_RESTART_RECOVERY'
        ORDER BY id DESC
        LIMIT 1
      `).get();

      res.json({
        success: true,
        data: {
          server_running: true,
          uptime_seconds: Math.floor(process.uptime()),
          server_start_time: SERVER_START_TIME,
          election_status: electionStatus,
          was_recovered: wasRecoveredFromOpen,
          last_recovery_log: recentRecovery || null,
          server_ip: SERVER_IP,
          port: PORT
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Database query failed' });
    }
  });

  // API Routes
  app.use('/api/public', publicRoutes);
  app.use('/api/candidates', (req, res, next) => {
    req.url = '/candidates';
    publicRoutes(req, res, next);
  });
  app.use('/api/statistics', (req, res, next) => {
    req.url = '/statistics';
    publicRoutes(req, res, next);
  });
  app.use('/api/votes', votesRoutes);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);

  // File Statis Publik (Client)
  const publicDir = path.resolve(__dirname, 'public');
  app.use(express.static(publicDir));

  // Route khusus untuk /tutorial
  app.use('/tutorial', express.static(path.resolve(__dirname, 'tutorial')));

  // Fallback untuk SPA / HTML utama
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // Jalankan listener pada 0.0.0.0 (kompatibel penuh di Windows, Linux, macOS)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 SISTEM E-VOTING PRODI TJKT - SMKS YASBAM BOGOR`);
    console.log(`=======================================================`);
    console.log(`* Local URL   : http://localhost:${PORT}`);
    console.log(`* Network LAN : http://${SERVER_IP}:${PORT}`);
    console.log(`* Monitoring  : http://${SERVER_IP}:${PORT}/admin.html`);
    console.log(`* Statistik   : http://${SERVER_IP}:${PORT}/statistik.html`);
    console.log(`* Tutorial    : http://${SERVER_IP}:${PORT}/tutorial/index.html`);
    console.log(`=======================================================`);
    console.log(`Catatan: Komputer pemilih (PC 1 - 5) cukup membuka:`);
    console.log(`👉 http://${SERVER_IP}:${PORT}/`);
    console.log(`=======================================================\n`);
  });

  const shutdown = (signal) => {
    console.log(`\n[SERVER] ${signal}: menyimpan database dan menghentikan server.`);
    try { db.saveToDisk(); } finally { process.exit(0); }
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer();
