const { initDatabase, dbPath } = require('./db');

initDatabase()
  .then(() => console.log(`Database siap: ${dbPath}`))
  .catch((error) => {
    console.error('Gagal menyiapkan database:', error.message);
    process.exitCode = 1;
  });
