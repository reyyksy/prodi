# Prodi E-Voting

Aplikasi pemilihan ketua dan wakil program keahlian berbasis Node.js, Express, dan SQLite (`sql.js` WebAssembly). Berjalan di Windows 10/11, Linux, dan macOS tanpa Python, Docker, compiler, atau layanan berbayar.

## Instalasi Windows PowerShell

```powershell
git clone https://github.com/reyyksy/prodi.git
Set-Location prodi
npm install
Rename-Item .env.example .env
notepad .env
npm run init-db
npm start
```

## Instalasi Linux

```bash
git clone https://github.com/reyyksy/prodi.git
cd prodi
npm install
mv .env.example .env
nano .env
npm run init-db
npm start
```

## Instalasi macOS

```bash
git clone https://github.com/reyyksy/prodi.git
cd prodi
npm install
mv .env.example .env
nano .env
npm run init-db
npm start
```

Gunakan Node.js LTS 20 atau 22 dan npm 10+. Perintah di atas mengubah nama `.env.example` menjadi `.env`. Buka `.env`, lalu isi `PORT`, `SESSION_SECRET` acak minimal 32 karakter, `ADMIN_DEFAULT_USER`, dan `ADMIN_DEFAULT_PASS`. Jangan commit `.env`.

Setelah server berjalan, buka `http://localhost:3000/`, `http://localhost:3000/admin.html`, atau `http://localhost:3000/statistik.html`. Untuk LAN, buka `http://IP-SERVER:3000/` dari komputer lain pada jaringan yang sama dan izinkan Node.js pada firewall Windows. Ganti port dengan mengubah `PORT=8080` di `.env`.

## Mengubah identitas

Edit `config/site.js` untuk nama sekolah, program, tahun ajaran, judul, logo, dan warna. Edit `config/paslon.js` untuk nomor urut, nama, foto, visi, misi, dan program kerja. Simpan foto di `public/images/` dalam format JPG, PNG, atau WebP dan gunakan path `/images/nama-file.jpg`. Kandidat yang sudah tersimpan di database tidak ditimpa otomatis.

Database aktif berada di `data/election.sqlite`, backup di `backups/`, dan laporan di `exports/`. Folder tersebut tidak masuk Git. Backup dan reset tersedia di panel admin; reset membuat backup otomatis. Hentikan server dengan `Ctrl+C`.

## Pemeriksaan dan masalah umum

Jalankan `npm run check` untuk memeriksa sintaks. Dependency database memakai `sql.js`, bukan `better-sqlite3`, sehingga tidak membutuhkan compiler. Jika instalasi gagal, gunakan Node.js LTS 20/22 dan jalankan `npm install` tanpa `--force` atau `--legacy-peer-deps`. Jika port bentrok, ubah `PORT`; jika LAN gagal, periksa firewall dan jaringan.

Gunakan aplikasi pada jaringan sekolah tepercaya, batasi akses admin, backup sebelum reset/restore, dan jangan mengekspos port langsung ke internet.
