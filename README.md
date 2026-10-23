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

Gunakan Node.js LTS 20 atau 22 dan npm 10+. Perintah di atas mengubah nama `.env.example` menjadi `.env`. Konfigurasi `.env` yang wajib diganti sebelum dipakai sungguh-sungguh adalah `SESSION_SECRET`, `ADMIN_DEFAULT_USER`, dan `ADMIN_DEFAULT_PASS`. `PORT` boleh tetap `3000`; ubah hanya jika port tersebut bentrok. `SESSION_SECRET` saat ini disiapkan untuk keamanan sesi dan harus berupa teks acak minimal 32 karakter. Jangan commit `.env`.

Ringkasan `.env`:

```env
PORT=3000                         # Opsional; port server
SESSION_SECRET=teks-acak-32-karakter  # Wajib diganti
ADMIN_DEFAULT_USER=admin          # Wajib diganti untuk instalasi nyata
ADMIN_DEFAULT_PASS=password-kuat  # Wajib diganti untuk instalasi nyata
```

Pada clone development ini login sementara adalah `admin` / `admin12345`. Password dari halaman admin juga memperbarui `ADMIN_DEFAULT_PASS` di `.env` development. `SESSION_SECRET` tidak boleh memakai nama sekolah, `admin123`, atau password admin.

Setelah server berjalan, buka `http://localhost:3000/`, `http://localhost:3000/admin.html`, atau `http://localhost:3000/statistik.html`. Untuk LAN, buka `http://IP-SERVER:3000/?pc=1` sampai `?pc=5` dari komputer pemilih. Identitas bilik memakai parameter `pc`, bukan IP PC, dan setiap suara otomatis membuka sesi pemilih berikutnya. Ganti port dengan mengubah `PORT=8080` di `.env`.

### Mode online sementara

Frontend online tersedia di `http://localhost:3000/online/` dan memakai backend serta database yang sama. Salin `online/.env.example` menjadi `online/.env`, lalu isi akun client resmi di server. Jangan menaruh `online/.env` di folder frontend publik atau GitHub. Akun online dapat memilih satu kali; identitas akun disimpan terpisah dari pilihan suara. Admin online tetap menggunakan `/admin.html` dengan akun admin yang sama.

`npm start` sekarang otomatis menjalankan backend port 3000 dan frontend online port 4000 sekaligus. Forward port 4000 saja. Akses online di `/`, admin di `/admin.html`, dan statistik di `/statistik.html`. Port 4000 meneruskan API ke backend port 3000. `npm run start:online` tetap tersedia untuk menjalankan frontend online saja saat debugging.

## Cek server dari terminal

Jalankan dari folder development `/home/reihan/repo/me/prodi1/prodi` (atau folder clone proyek pada Windows/macOS):

```text
node --version
npm --version
npm run check
npm run init-db
npm start
```

Biarkan server berjalan, buka terminal kedua, lalu cek:

```text
curl http://localhost:3000/api/health
curl http://localhost:3000/api/public/election-status
```

Respons health harus memuat `"server_running":true`. Pada PowerShell gunakan `Invoke-WebRequest http://localhost:3000/api/health` bila `curl` tidak tersedia. Hentikan server dengan `Ctrl+C`; jika port bentrok, ubah `PORT` di `.env` dan gunakan port itu pada URL pengecekan.

## Development dan clone release

Perubahan dikerjakan dan dicek di `/home/reihan/repo/me/prodi1/prodi`. Hasil final disiapkan di clone fresh `/home/reihan/repo/me/prodi` untuk commit dan push GitHub. Di clone release, ulangi `npm install`, `npm run check`, `npm run init-db`, dan `npm start` sebelum `git status` dan push. Jangan menyalin `node_modules`, `data`, `backups`, `exports`, atau `.env`.

## Mengubah identitas

Edit `config/site.js` untuk nama sekolah, program, tahun ajaran, judul, logo, dan warna. Edit `config/paslon.js` untuk nomor urut, nama, foto, visi, misi, dan program kerja. Simpan foto di `public/images/` dalam format JPG, PNG, atau WebP dan gunakan path `/images/nama-file.jpg`. Kandidat yang sudah tersimpan di database tidak ditimpa otomatis.

Database aktif berada di `data/election.sqlite`, backup di `backups/`, dan laporan di `exports/`. Folder tersebut tidak masuk Git. Backup dan reset tersedia di panel admin; reset membuat backup otomatis. Hentikan server dengan `Ctrl+C`.

## Pemeriksaan dan masalah umum

Jalankan `npm run check` untuk memeriksa sintaks. Dependency database memakai `sql.js`, bukan `better-sqlite3`, sehingga tidak membutuhkan compiler. Jika instalasi gagal, gunakan Node.js LTS 20/22 dan jalankan `npm install` tanpa `--force` atau `--legacy-peer-deps`. Jika port bentrok, ubah `PORT`; jika LAN gagal, periksa firewall dan jaringan.

Jika `npm run init-db` atau `npm start` menampilkan `Cannot find module './auth'` dari `src/db.js`, file sumber `src/auth.js` kemungkinan terhapus dari working tree. Periksa dengan `git status --short`; jika muncul `D src/auth.js`, pulihkan file itu dari Git:

```powershell
git restore src/auth.js
npm run init-db
npm start
```

Di Linux/macOS, perintah Git yang sama berlaku. `npm install` tidak memperbaiki error ini karena `./auth` adalah file proyek, bukan paket npm. Jika ada file proyek lain berstatus `D`, pulihkan hanya file yang memang terhapus dan ingin dikembalikan.

Gunakan aplikasi pada jaringan sekolah tepercaya, batasi akses admin, backup sebelum reset/restore, dan jangan mengekspos port langsung ke internet.
