const { spawn } = require('child_process');

const children = [
  spawn(process.execPath, ['server.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['online-server.js'], { stdio: 'inherit' })
];

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500);
}

for (const child of children) {
  child.on('error', err => {
    console.error('[START] Gagal menjalankan proses:', err.message);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[START] Proses berhenti (code=${code}, signal=${signal || '-'})`);
      shutdown(code || 1);
    }
  });
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
