# Prodi E-Voting

Aplikasi pemilihan ketua dan wakil program keahlian berbasis Node.js, Express, dan SQLite melalui `sql.js` (WebAssembly). Berjalan lokal/LAN tanpa Python, Docker, compiler, atau layanan berbayar.

## Fitur dan persyaratan

Bilik pemilih anonim dengan tiga pasangan calon, detail visi/misi/program, konfirmasi dua tahap, panel admin terautentikasi, start/pause/stop/reset, monitoring PC 1–5, audit log, backup, ekspor Excel, dan statistik backend otomatis. Memerlukan Node.js LTS 20/22 dan npm 10+ pada Windows 10/11, Linux, atau macOS.

## Instalasi

```bash
git clone https://github.com/reyyksy/prodi.git
cd prodi
npm install
```

Salin `.env.example` menjadi `.env`: PowerShell `Copy-Item .env.example .env`; Linux/macOS `cp .env.example .env`. Lalu `npm run init-db` dan `npm start`.

Buka `http://localhost:3000/`, `/admin.html`, `/statistik.html`, atau `/tutorial/`. Untuk LAN gunakan `http://IP-KOMPUTER-SERVER:3000/`; izinkan Node.js di firewall. Port dapat diubah dengan `PORT=8080` di `.env`.

## Konfigurasi

Edit `config/site.js` untuk identitas sekolah, program, tahun ajaran, judul, logo, dan warna. Edit `config/paslon.js` untuk nomor, nama, foto, visi, misi, dan program kerja. Foto disimpan di `public/images/` (JPG, PNG, WebP) dengan path `/images/nama-file.jpg`. Kandidat yang sudah masuk database tidak ditimpa otomatis.

`.env` menyimpan port dan kredensial awal admin; jangan commit dan segera ganti password dari panel.

## Data, backup, dan troubleshooting

Database: `data/election.sqlite`; backup: `backups/`; ekspor: `exports/`. Folder runtime di-ignore Git. Backup dan reset tersedia di panel; reset selalu membuat backup otomatis. Hentikan server dengan `Ctrl+C`. `npm run check` memeriksa sintaks. Proyek memakai `sql.js`, bukan `better-sqlite3`, sehingga tidak membutuhkan compiler Windows. Jika port bentrok ubah `PORT`; jika LAN gagal periksa firewall dan jaringan. Jangan gunakan `--force` atau `--legacy-peer-deps`.

Gunakan jaringan sekolah tepercaya, batasi akses admin, backup sebelum reset/restore, dan jangan mengekspos port langsung ke internet. Lisensi open-source belum ditetapkan; tambahkan `LICENSE` sebelum distribusi publik.
