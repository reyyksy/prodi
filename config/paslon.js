/**
 * Konfigurasi Pasangan Calon (Kandidat) Ketua & Wakil Ketua Prodi TJKT
 * SMKS YASBAM KOTA BOGOR
 * File ini bersifat privat (backend only) dan diselaraskan ke database saat inisialisasi.
 */

module.exports = [
  {
    ballot_number: 1,
    chair_name: "Ahmad Fauzan Syahputra",
    vice_name: "Muhammad Rizky Pratama",
    vision: "Mewujudkan Prodi TJKT SMK Yasbam yang unggul di bidang networking dan cloud computing, berdaya saing industri, berlandaskan akhlaqul karimah.",
    mission: "1. Menyelenggarakan pelatihan dan sertifikasi mikrotik/cisco bagi siswa TJKT.\n2. Mengoptimalkan sarana laboratorium jaringan komputer dengan manajemen modern.\n3. Menumbuhkan budaya kolaborasi, kedisiplinan kerja, dan inovasi teknologi.",
    programs: [
      "TJKT Cyber & Network Bootcamp: Pelatihan praktikum intensif routing, switching & server.",
      "Laboratorium Care & Troubleshooting Clinic: Layanan berkala perbaikan perangkat jaringan.",
      "Kunjungan Industri & Guest Lecture dari Network Engineer terkemuka."
    ],
    photo_path: "/images/paslon-1.jpg"
  },
  {
    ballot_number: 2,
    chair_name: "Dimas Aditya Pratama",
    vice_name: "Siti Nurhaliza Zahra",
    vision: "Menciptakan komunitas TJKT yang berkarakter islami, adaptif terhadap perkembangan telekomunikasi dan IoT, serta mandiri dalam berkarya.",
    mission: "1. Meningkatkan keterlibatan siswa dalam proyek IoT dan implementasi jaringan nirkabel.\n2. Mendorong sikap birrul walidain dan etos kerja profesional dalam setiap kegiatan kejuruan.\n3. Mempererat sinergi antara alumni TJKT SMK Yasbam dengan adik kelas.",
    programs: [
      "IoT Innovation Fair: Pameran inovasi perangkat smart monitoring berbasis sensor & WiFi.",
      "TJKT Mentorship & Alumni Connect: Berbagi pengalaman industri dan persiapan magang/PKL.",
      "Kajian Karakter Vokasi Rasa Nyantri: Penguatan mental dan moral generasi teknologi."
    ],
    photo_path: "/images/paslon-2.jpg"
  },
  {
    ballot_number: 3,
    chair_name: "Rafi Muhammad Al-Ghifari",
    vice_name: "Fadhil Arya Wicaksana",
    vision: "Menjadikan keahlian TJKT SMK Yasbam sebagai pelopor inovasi sistem otomasi jaringan, keamanan siber, dan technopreneurship berstandar nasional.",
    mission: "1. Melatih kesiapan siswa menghadapi uji kompetensi keahlian dan lomba keterampilan siswa (LKS).\n2. Membangun unit produksi jasa instalasi jaringan dan perakitan komputer sekolah.\n3. Mengintegrasikan teknologi ramah lingkungan dalam infrastruktur IT laboratorium.",
    programs: [
      "Cyber Defense & Ethical Hacking Intro: Workshop keamanan siber dasar dan proteksi jaringan.",
      "Unit Bisnis TJKT Service Corner: Praktik wirausaha jasa networking untuk umum dan warga sekolah.",
      "Pekan Olahraga & E-Sport TJKT: Mempererat solidaritas dan sportivitas antarkelas."
    ],
    photo_path: "/images/paslon-3.jpg"
  }
];
