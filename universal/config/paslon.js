/**
 * Konfigurasi Pasangan Calon (Kandidat) Ketua & Wakil Ketua OSIS
 * SMKS YASBAM KOTA BOGOR
 * File ini bersifat privat (backend only) dan diselaraskan ke database saat inisialisasi.
 */

const candidates = [
  {
    ballot_number: 1,
    chair_name: "Tirta Ridho Khoerija",
    vice_name: "Alifah Tun Julfirda",
    vision: "Mewujudkan siswa/i yang disiplin, peduli, dan berintegritas serta mampu bekerja sama menciptakan lingkungan belajar yang sehat, bersih, dan berkarakter dan juga menjadikan OSIS sebagai wadah aspirasi yang efektif, tempat ide-ide siswa/i dapat diwujudkan.",
    mission: "1. Menegaskan kerapihan serta kesopanan dalam berpakaian.\n2. Mengevaluasi hal-hal yang telah dilaksanakan agar menjadi lebih baik.\n3. Membangun OSIS yang profesional, responsif, dan dekat dengan kebutuhan siswa/i.\n4. Mengembangkan kegiatan kreatif-inovatif serta menginspirasi siswa dalam berprestasi di bidang akademik dan non-akademik.",
    photo_path: "/images/paslon-1.jpg"
  },
  {
    ballot_number: 2,
    chair_name: "Yudis",
    vice_name: "Tenyaho",
    vision: "Mewujudkan siswa/i SMK Yasbam yang dapat mengedepankan keimanan dan ketakwaan, serta menampung aspirasi dan kreativitas siswa/i SMK Yasbam dalam mengedepankan prestasi akademik maupun non-akademik.",
    mission: "1. Mewujudkan siswa/i SMK Yasbam yang bertakwa kepada Tuhan Yang Maha Esa.\n2. Meningkatkan kedisiplinan dan kesadaran siswa/i SMK Yasbam dalam menaati peraturan-peraturan yang berlaku.\n3. Mewujudkan siswa/i SMK Yasbam yang pandai bersosialisasi dengan baik di mana pun.\n4. Mewujudkan siswa/i SMK Yasbam yang berbudaya cinta lingkungan.\n5. Mengasah keterampilan siswa/i SMK Yasbam dalam bidang kesenian dan keolahragaan.\n6. Meningkatkan mutu prestasi akademik maupun non-akademik para siswa/i SMK Yasbam.",
    photo_path: "/images/paslon-2.jpg"
  },
  {
    ballot_number: 3,
    chair_name: "Muhamad Fhatir",
    vice_name: "Anwar",
    vision: "Mewujudkan OSIS SMK Yasbam Kota Bogor yang aktif, kreatif, dan inspiratif melalui 3M (Mampu Melaksanakan, Mampu Mewujudkan, dan Mampu Meneladani).",
    mission: "1. Meningkatkan kerja sama antara OSIS dan prodi dalam menciptakan lingkungan sekolah yang nyaman dan menyenangkan bagi siswa/i di sekolah.\n2. Menanamkan nilai-nilai kebersamaan, solidaritas, dan kepedulian terhadap sesama warga sekolah.\n3. Menumbuhkan sikap disiplin, bertanggung jawab, dan peduli, serta membangun pengurus OSIS yang dapat menjadi teladan bagi siswa lainnya.\n4. Meningkatkan kreativitas dan inovasi dalam berbagai kegiatan OSIS untuk mewujudkan sekolah yang lebih maju dan berprestasi.",
    photo_path: "/images/paslon-3.jpg"
  }
];

// KONFIGURASI UTAMA APLIKASI
// Edit file ini untuk mengganti sekolah, judul, tahun, kandidat, visi, misi,
// dan foto. Semua halaman membaca data melalui konfigurasi ini.
candidates.siteConfig = {
  schoolName: 'SMKS YASBAM KOTA BOGOR',
  programName: 'OSIS SMKS YASBAM',
  academicYear: '2026/2027',
  electionTitle: 'Pemilihan Ketua & Wakil Ketua OSIS',
  schoolLogo: '/images/yasbam.jpg',
  programLogo: '/images/tjkt.jpg',
  theme: { primary: '#142B4A', teal: '#0D9488' }
};

module.exports = candidates;
