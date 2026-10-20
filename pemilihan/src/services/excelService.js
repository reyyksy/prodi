const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { db, exportsDir } = require('../db');

async function generateElectionExcel() {
  const electionTitle = db.prepare("SELECT value FROM settings WHERE key = 'election_title'").get()?.value || 'Pemilihan Ketua & Wakil Ketua Prodi TJKT';
  const schoolName = db.prepare("SELECT value FROM settings WHERE key = 'school_name'").get()?.value || 'SMKS YASBAM KOTA BOGOR';
  const status = db.prepare("SELECT value FROM settings WHERE key = 'election_status'").get()?.value || 'draft';
  const totalVotes = db.prepare('SELECT COUNT(*) as total FROM votes').get()?.total || 0;

  const candidates = db.prepare(`
    SELECT c.id, c.ballot_number, c.chair_name, c.vice_name,
           COUNT(v.id) as vote_count
    FROM candidates c
    LEFT JOIN votes v ON v.candidate_id = c.id
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.ballot_number ASC
  `).all();

  const auditLogs = db.prepare(`
    SELECT action, details, admin_username, ip_address, created_at
    FROM audit_logs
    ORDER BY id DESC
    LIMIT 200
  `).all();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistem E-Voting TJKT SMK Yasbam';
  workbook.created = new Date();

  // Sheet 1: Ringkasan
  const summarySheet = workbook.addWorksheet('Ringkasan Eksekutif');
  summarySheet.columns = [
    { header: 'Parameter', key: 'key', width: 30 },
    { header: 'Nilai / Keterangan', key: 'value', width: 50 }
  ];

  summarySheet.addRow({ key: 'Institusi', value: schoolName });
  summarySheet.addRow({ key: 'Nama Pemilihan', value: electionTitle });
  summarySheet.addRow({ key: 'Program Keahlian', value: 'Teknik Jaringan Komputer dan Telekomunikasi (TJKT)' });
  summarySheet.addRow({ key: 'Status Pemilihan', value: status.toUpperCase() });
  summarySheet.addRow({ key: 'Waktu Cetak Laporan', value: new Date().toLocaleString('id-ID') });
  summarySheet.addRow({ key: 'Total Suara Masuk', value: totalVotes });

  // Tentukan pemenang
  let maxV = -1;
  let winners = [];
  for (const c of candidates) {
    if (c.vote_count > maxV) {
      maxV = c.vote_count;
      winners = [c];
    } else if (c.vote_count === maxV && maxV > 0) {
      winners.push(c);
    }
  }

  let finalNote = 'Belum Diputuskan';
  if (totalVotes === 0) {
    finalNote = 'Tidak ada suara yang masuk';
  } else if (winners.length > 1) {
    finalNote = 'HASIL SERI / DRAW antara paslon: ' + winners.map(w => `No. ${w.ballot_number} (${w.chair_name})`).join(', ');
  } else if (winners.length === 1) {
    finalNote = `TERPILIH: No. ${winners[0].ballot_number} - ${winners[0].chair_name} & ${winners[0].vice_name} (${winners[0].vote_count} Suara)`;
  }
  summarySheet.addRow({ key: 'Keputusan Hasil', value: finalNote });

  // Format header
  summarySheet.getRow(1).font = { bold: true };

  // Sheet 2: Hasil Kandidat (Agregat)
  const resultSheet = workbook.addWorksheet('Hasil Perolehan Suara');
  resultSheet.columns = [
    { header: 'No. Urut', key: 'ballot_number', width: 12 },
    { header: 'Calon Ketua', key: 'chair_name', width: 30 },
    { header: 'Calon Wakil', key: 'vice_name', width: 30 },
    { header: 'Jumlah Suara', key: 'vote_count', width: 16 },
    { header: 'Persentase', key: 'percentage', width: 16 },
    { header: 'Status Akhir', key: 'status_label', width: 22 }
  ];
  resultSheet.getRow(1).font = { bold: true };

  candidates.forEach(c => {
    const pct = totalVotes > 0 ? ((c.vote_count / totalVotes) * 100).toFixed(1) + '%' : '0.0%';
    let statusLabel = '-';
    if (status === 'closed') {
      if (winners.length === 1 && winners[0].id === c.id) {
        statusLabel = 'Pemenang Terpilih';
      } else if (winners.length > 1 && winners.some(w => w.id === c.id)) {
        statusLabel = 'Seri (Draw)';
      } else {
        statusLabel = 'Tidak Terpilih';
      }
    }
    resultSheet.addRow({
      ballot_number: c.ballot_number,
      chair_name: c.chair_name,
      vice_name: c.vice_name,
      vote_count: c.vote_count,
      percentage: pct,
      status_label: statusLabel
    });
  });

  // Sheet 3: Audit Log (DILARANG mencatat isi pilihan suara individu)
  const auditSheet = workbook.addWorksheet('Audit Log Sistem');
  auditSheet.columns = [
    { header: 'Waktu (UTC)', key: 'created_at', width: 24 },
    { header: 'Aksi', key: 'action', width: 22 },
    { header: 'Pelaksana', key: 'admin_username', width: 18 },
    { header: 'Alamat IP', key: 'ip_address', width: 18 },
    { header: 'Rincian Aktivitas', key: 'details', width: 45 }
  ];
  auditSheet.getRow(1).font = { bold: true };

  auditLogs.forEach(log => {
    auditSheet.addRow({
      created_at: log.created_at,
      action: log.action,
      admin_username: log.admin_username || 'SYSTEM',
      ip_address: log.ip_address || '127.0.0.1',
      details: log.details || ''
    });
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `Laporan_Hasil_Pemilihan_TJKT_${timestamp}.xlsx`;
  const filePath = path.join(exportsDir, filename);

  await workbook.xlsx.writeFile(filePath);

  return { filename, filePath };
}

module.exports = {
  generateElectionExcel
};
