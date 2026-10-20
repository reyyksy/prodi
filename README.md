# SISTEM E-VOTING KETUA & WAKIL KETUA PRODI TJKT
## SMKS YASBAM KOTA BOGOR (Tahun Ajaran 2026/2027)
**Repositori Resmi GitHub:** [https://github.com/reyyksy/prodi.git](https://github.com/reyyksy/prodi.git)

Aplikasi pemilihan umum berbasis Web dan Jaringan Lokal (LAN) untuk pemilihan Ketua dan Wakil Ketua Program Keahlian **Teknik Jaringan Komputer dan Telekomunikasi (TJKT) SMKS Yasbam Kota Bogor**. Sistem dirancang sesuai spesifikasi dokumen arsitektur dan bisnis `fixx.md` versi 1.1, mengedepankan **anonimitas suara**, **integritas data berbasis transaksi SQLite WAL**, serta kemudahan **monitoring 5 PC bilik suara**.

---

## 🌟 Fitur Utama Sistem

1. **Anonimitas Suara Mutlak (Privacy-First):**
   - Tabel `votes` **TIDAK menyimpan** data nama siswa, NIS, alamat IP, ID PC, maupun ID sesi bilik.
   - Admin tidak dapat mengidentifikasi atau menelusuri pemilih tertentu memilih kandidat yang mana.
2. **Monitoring 5 PC Bilik Suara (Real-time):**
   - Pemantauan status live PC 1 hingga PC 5: *Siap memilih*, *Sedang memilih*, dan *Sudah memilih - menunggu panitia*.
   - Fitur **"Siapkan untuk pemilih berikutnya"** murni menyetel ulang sesi layar bilik pemilih tanpa menghapus suara yang sudah tersimpan.
3. **Konfirmasi Suara Bertingkat (Two-Stage Confirmation):**
   - Mencegah siswa salah klik dengan dialog rangkuman tahap 1 dan tombol konfirmasi final dengan penukaran posisi tombol pada dialog tahap 2.
4. **Keamanan & Kontrol Pemilihan:**
   - Panel admin dilindungi login dengan enkripsi password (scrypt hashing), rate limiting, dan session cookie HTTP-Only.
   - Kontrol pemilihan: *Buka (Open)*, *Jeda (Pause)*, *Tutup Final (Stop)*, dan *Reset Data (Wajib Frasa + Password)*.
   - *Safety Restart Recovery*: Jika server mati lampu atau ter-restart saat status `OPEN`, sistem otomatis beralih ke `PAUSED` untuk keamanan dan memberikan banner peringatan di halaman admin.
   - Indikator live status server di panel admin: mendeteksi dan memberi tahu dengan teks & banner jelas apakah server offline / mati, dalam mode pemulihan, sedang aktif buka, atau sedang dijeda.
5. **Statistik Publik & Diagram Bar Perbandingan:**
   - Halaman publik `/statistik.html` dilengkapi **diagram horizontal bar perbandingan suara (stacked & per-paslon)**.
   - *Snapshot interval sistem 15 menit*: Me-refresh browser tidak langsung mengubah suara, data teragregasi secara terjadwal by sistem.
   - Mode final otomatis setelah pemilihan ditutup (menampilkan pemenang sah / status SERI).
6. **Ekspor Laporan Excel (.xlsx) & Backup Database:**
   - Cetak laporan resmi hasil pemilihan ke dalam file spreadsheet Excel (Sheet Ringkasan Eksekutif, Hasil Agregat Paslon, dan Audit Log Sistem).
   - Backup database otomatis dan manual menggunakan *SQLite Online Backup API*.
7. **Deteksi Otomatis IP Jaringan LAN & Zero-Config Cross-Platform:**
   - Server Node.js mendeteksi antarmuka IP host secara otomatis di Windows maupun Linux.
   - **Zero-configuration**: Tanpa perlu repot membuat file `.env` manual, tinggal clone dan langsung jalan sebagai user biasa (non-root).

---

## 🏛️ Identitas Sekolah & Program Keahlian
- **Institusi:** SMKS YASBAM KOTA BOGOR (NPSN: 20271224, Terakreditasi A)
- **Yayasan:** Yayasan Baitul Mukaromah
- **Alamat:** Jl. H.E. Sukma Bakomsari No. 91, RT 03/12, Kel. Harjasari, Kec. Bogor Selatan, Kota Bogor
- **Website Resmi:** [smkyasbam.sch.id](https://smkyasbam.sch.id/)
- **Motto / Slogan:** *"Sekolah Vokasi, Rasa Nyantri"* – Generasi Islami, Mandiri, Berakhlaqul Karimah, Birrul Walidain.
- **Kompetensi Keahlian:** Teknik Jaringan Komputer dan Telekomunikasi (TJKT)

---

## 🚀 Panduan Setup di Komputer Lain (Windows & Linux)

### 1. Prasyarat Software di Komputer
Cukup pastikan di komputer telah terpasang:
- **Git:** [git-scm.com](https://git-scm.com/) (atau via package manager).
- **Node.js (LTS v18/v20):** [nodejs.org](https://nodejs.org/).
- **Browser:** Google Chrome, Edge, atau Firefox.

### 2. Langkah Clone & Langsung Jalankan
Buka Command Prompt (Windows) atau Terminal (Linux):
```bash
# 1. Clone repositori
git clone https://github.com/reyyksy/prodi.git

# 2. Masuk ke folder proyek
cd prodi

# 3. Install dependensi
npm install

# 4. Jalankan server (kompatibel Windows & Linux, non-root)
npm start
```

Terminal akan menampilkan informasi alamat akses LAN:
```text
=======================================================
🚀 SISTEM E-VOTING PRODI TJKT - SMKS YASBAM BOGOR
=======================================================
* Local URL   : http://localhost:3000
* Network LAN : http://192.168.1.17:3000
* Monitoring  : http://192.168.1.17:3000/admin.html
* Statistik   : http://192.168.1.17:3000/statistik.html
* Tutorial    : http://192.168.1.17:3000/tutorial/index.html
=======================================================
```

---

## 💻 Pengaturan Komputer Bilik Suara (PC 1 - 5)

Pada masing-masing komputer bilik suara siswa di lab komputer, buka browser dan arahkan ke alamat berikut:
- **PC 1:** `http://<IP-SERVER>:3000/?pc=1`
- **PC 2:** `http://<IP-SERVER>:3000/?pc=2`
- **PC 3:** `http://<IP-SERVER>:3000/?pc=3`
- **PC 4:** `http://<IP-SERVER>:3000/?pc=4`
- **PC 5:** `http://<IP-SERVER>:3000/?pc=5`

*Tips:* Tekan tombol `F11` pada keyboard untuk mengaktifkan tampilan layar penuh (Kiosk Mode).

---

## 📖 Panduan Lengkap Single-File HTML
Tersedia dokumentasi dan buku panduan lengkap yang tersimpan dalam satu file mandiri (HTML, CSS, dan JS internal) yang dapat dibuka secara luring (offline) maupun daring:
- URL Web: `http://<IP-SERVER>:3000/tutorial/index.html`
- Path Berkas: `tutorial/index.html`
