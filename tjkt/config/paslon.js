/**
 * Konfigurasi Pasangan Calon (Kandidat) Ketua & Wakil Ketua Prodi TJKT
 * SMKS YASBAM KOTA BOGOR
 * File ini bersifat privat (backend only) dan diselaraskan ke database saat inisialisasi.
 */

const candidates = [
  {
    ballot_number: 1,
    chair_name: "Putri Aulia. S",
    vice_name: "Muhammad Desqi Suherlan",
    vision: "Menjadikan jurusan TKJ sebagai wadah bagi siswa untuk mengembangkan kompetensi, karakter, kreativitas, dan kesiapan menghadapi perkembangan teknologi serta dunia kerja.",
    mission: "1. Meningkatkan pengalaman dan wawasan siswa tentang dunia industri.\n2. Meningkatkan pengalaman siswa melalui proyek nyata dan kegiatan teknologi.\n3. Mendorong siswa untuk berani mencoba, bertanya, dan berinovasi.",
    programs: [
      "Network Challenge: kompetisi tahunan membuat kabel FO terbaik untuk kelas 10.",
      "Network Challenge: memecahkan masalah jaringan dengan Cisco Packet Tracer untuk kelas 12.",
      "Network Challenge: menghitung IP secara lengkap dan tercepat untuk kelas 11."
    ],
    photo_path: "/images/paslon-1.jpg"
  },
  {
    ballot_number: 2,
    chair_name: "Fadlan Fauzan",
    vice_name: "Annisa Nandita Putri",
    vision: "Mewujudkan jurusan TKJ yang aktif, inovatif, dan menjadi wadah bagi seluruh siswa untuk berkembang dalam bidang teknologi, kreativitas, serta kerjasama dengan mengutamakan kekeluargaan dan aksi nyata yang berdampak positif untuk semua.",
    mission: "1. Meningkatkan kekompakan dan rasa kebersamaan antar siswa TKJ.\n2. Mendorong siswa mengembangkan kemampuan teknologi dan jaringan komputer.\n3. Menyelenggarakan kegiatan edukatif, kreatif, dan bermanfaat.\n4. Membangun budaya saling membantu dan berbagi ilmu.\n5. Membuka ruang ide, aspirasi, dan kritik positif.\n6. Menjalankan organisasi dengan tanggung jawab dan semangat kerja tim.",
    programs: [
      "Kegiatan edukatif dan kreatif yang memperkuat kekompakan siswa TKJ.",
      "Forum aspirasi dan berbagi ilmu antar siswa TKJ.",
      "Kolaborasi teknologi dan jaringan komputer dengan aksi nyata."
    ],
    photo_path: "/images/paslon-2.jpg"
  },
  {
    ballot_number: 3,
    chair_name: "R. Muhammad Duyeh",
    vice_name: "Muhammad Akhtar Rangkuti",
    vision: "Melanjutkan program-program yang sudah berjalan baik selama ini dan memperbaiki serta meningkatkan fasilitas TJKT untuk kenyamanan belajar dan memaksimalkan kemampuan siswa-siswi.",
    mission: "1. Layanan pinjaman kabel RJ45 (LAN) dan perapihan router atau alat praktik di setiap lab TJKT.\n2. Layanan konsultasi untuk bimbingan belajar bersama dan keluhan fasilitas TJKT.\n3. Melanjutkan bisnis TJKT.",
    programs: [
      "Layanan pinjaman kabel RJ45 dan perapihan alat praktik di lab TJKT.",
      "Layanan konsultasi bimbingan belajar dan fasilitas TJKT.",
      "Melanjutkan bisnis TJKT."
    ],
    photo_path: "/images/paslon-3.jpg"
  }
];

// KONFIGURASI UTAMA APLIKASI
// Edit file ini untuk mengganti sekolah, judul, tahun, kandidat, visi, misi,
// program kerja, dan foto. Semua halaman membaca data melalui konfigurasi ini.
candidates.siteConfig = {
  schoolName: 'SMKS YASBAM KOTA BOGOR',
  programName: 'Program Keahlian TJKT',
  academicYear: '2026/2027',
  electionTitle: 'Pemilihan Ketua & Wakil Ketua Program Keahlian TJKT',
  schoolLogo: '/images/yasbam.jpg',
  programLogo: '/images/tjkt.jpg',
  theme: { primary: '#142B4A', teal: '#0D9488' }
};

module.exports = candidates;
