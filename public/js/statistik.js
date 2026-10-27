// Logika Halaman Statistik Publik (Bab 9 fixx.md + Perlindungan Refresh Snapshot Sistem)
(function() {
  const API_BASE = '/api';

  const statsMainTitle = document.getElementById('statsMainTitle');
  const statsSubtitle = document.getElementById('statsSubtitle');
  const lastUpdatedLabel = document.getElementById('lastUpdatedLabel');
  const statsTotalVotes = document.getElementById('statsTotalVotes');
  const finalStatusAlert = document.getElementById('finalStatusAlert');
  const statsCandidatesContainer = document.getElementById('statsCandidatesContainer');
  const stackedBarContainer = document.getElementById('stackedBarContainer');
  const chartLegendContainer = document.getElementById('chartLegendContainer');
  const chartProportionSummary = document.getElementById('chartProportionSummary');
  const pieCenterTotal = document.getElementById('pieCenterTotal');
  const systemStatusBanner = document.getElementById('systemStatusBanner');
  const systemStatusText = document.getElementById('systemStatusText');
  const systemStatusTime = document.getElementById('systemStatusTime');
  const systemCountdown = document.getElementById('systemCountdown');
  let nextUpdateTimestamp = null;

  // Palette warna berstandar rasio kontras 4.5:1+ untuk tiap nomor urut
  const CANDIDATE_COLORS = [
    { bg: '#2563eb', border: '#1d4ed8', name: 'Biru' },    // Paslon 1
    { bg: '#0d9488', border: '#0f766e', name: 'Teal' },    // Paslon 2
    { bg: '#ea580c', border: '#c2410c', name: 'Oranye' },  // Paslon 3
  ];


  async function loadStatistics() {
    try {
      const res = await fetch(`${API_BASE}/statistics`);
      const json = await res.json();
      if (json.success) {
        renderStatistics(json.data);
      }
    } catch (e) {
      statsMainTitle.textContent = 'SERVER OFFLINE';
      statsSubtitle.textContent = 'Statistik sementara tidak dapat diperbarui karena server tidak terhubung.';
      finalStatusAlert.style.display = 'block';
      finalStatusAlert.style.background = '#fef2f2';
      finalStatusAlert.style.color = '#b91c1c';
      finalStatusAlert.textContent = 'KONDISI: Server mati atau dijeda. Data terakhir ditampilkan bila tersedia.';
      statsCandidatesContainer.innerHTML = `<div style="text-align: center; color: #dc2626; padding: 2rem;">Gagal memuat data statistik: ${e.message}</div>`;
      systemStatusBanner.style.background = '#fef2f2';
      systemStatusBanner.style.color = '#b91c1c';
      systemStatusText.textContent = '🔴 SERVER OFFLINE — statistik tidak dapat diperbarui';
      systemStatusTime.textContent = 'Menunggu koneksi kembali';
      systemCountdown.textContent = '--:--';
    }
  }

  function renderStatistics(data) {
    const isClosed = data.election_status === 'closed';
    statsTotalVotes.textContent = data.total_votes;
    const statusLabels = { open: '🟢 SERVER AKTIF — PEMILIHAN SEDANG BERJALAN', paused: '🟠 SERVER AKTIF — PEMILIHAN DIJEDA', draft: '⚪ SERVER AKTIF — PEMILIHAN BELUM DIMULAI', closed: '🔵 SERVER AKTIF — HASIL FINAL / PEMILIHAN DITUTUP' };
    systemStatusText.textContent = statusLabels[data.election_status] || 'SERVER AKTIF';
    nextUpdateTimestamp = data.next_update ? new Date(data.next_update).getTime() : null;
    systemStatusTime.textContent = `Pembaruan data: ${data.next_update ? new Date(data.next_update).toLocaleTimeString('id-ID') : 'final'}`;
    systemStatusBanner.style.background = isClosed ? '#dcfce7' : (data.election_status === 'paused' ? '#fffbeb' : '#eef2ff');
    systemStatusBanner.style.color = isClosed ? '#166534' : (data.election_status === 'paused' ? '#92400e' : '#3730a3');

    if (data.last_updated) {
      const d = new Date(data.last_updated);
      lastUpdatedLabel.textContent = `Update Terakhir: ${d.toLocaleTimeString('id-ID')} WIB`;
    }

    if (isClosed) {
      // Masuk mode final
      statsMainTitle.textContent = 'HASIL FINAL PEMILIHAN RESMI';
      statsSubtitle.textContent = 'Pemilihan telah ditutup secara sah oleh administrator.';

      finalStatusAlert.style.display = 'block';
      if (data.result_status === 'no_votes') {
        finalStatusAlert.style.background = '#fef2f2';
        finalStatusAlert.style.color = '#b91c1c';
        finalStatusAlert.textContent = 'HASIL FINAL: Tidak ada suara yang masuk dalam pemilihan ini.';
      } else if (data.result_status === 'tie') {
        finalStatusAlert.style.background = '#fffbeb';
        finalStatusAlert.style.color = '#b45309';
        finalStatusAlert.textContent = 'HASIL FINAL: STATUS SERI (DRAW) antar pasangan calon peraih suara tertinggi!';
      } else {
        finalStatusAlert.style.background = '#dcfce7';
        finalStatusAlert.style.color = '#15803d';
        finalStatusAlert.textContent = 'HASIL FINAL: Pasangan calon pemenang telah resmi ditetapkan secara sah!';
      }
    } else {
      statsMainTitle.textContent = 'HASIL SEMENTARA PEMILIHAN';
      if (data.election_status === 'paused') {
        statsSubtitle.textContent = 'Server hidup, tetapi pemilihan sedang dijeda oleh admin.';
        finalStatusAlert.style.display = 'block';
        finalStatusAlert.style.background = '#fffbeb';
        finalStatusAlert.style.color = '#b45309';
        finalStatusAlert.textContent = 'KONDISI: Pemilihan dijeda. Statistik belum final.';
      } else {
        statsSubtitle.textContent = 'Data perolehan suara sementara dan anonim.';
        finalStatusAlert.style.display = 'none';
      }
    }

    // 1. Render diagram lingkaran perbandingan suara gabungan
    renderStackedComparisonBar(data);

    // 2. Render Baris Kartu Paslon Vertikal dengan Progress Bar Individual
    renderCandidateRows(data, isClosed);
  }

  function renderStackedComparisonBar(data) {
    const total = data.total_votes;
    if (pieCenterTotal) pieCenterTotal.textContent = total;
    if (total === 0) {
      stackedBarContainer.style.background = '#e2e8f0';
      chartProportionSummary.textContent = '0 Suara Masuk';
      chartLegendContainer.innerHTML = data.candidates.map((c, i) => {
        const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length];
        return `
          <div class="legend-item">
            <span class="legend-color" style="background: ${color.bg};"></span>
            <span>No. ${c.ballot_number} (${c.chair_name})</span>
          </div>
        `;
      }).join('');
      return;
    }

    chartProportionSummary.textContent = `Total ${total} Suara Sah`;

    // Segmen conic-gradient: satu diagram gabungan untuk seluruh paslon.
    let cursor = 0;
    const segments = data.candidates.map((c, i) => {
      const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length];
      const pct = c.percentage;
      const start = cursor;
      cursor += pct;
      return `${color.bg} ${start}% ${cursor}%`;
    }).join(', ');
    stackedBarContainer.style.background = `conic-gradient(${segments})`;

    // Legend
    chartLegendContainer.innerHTML = data.candidates.map((c, i) => {
      const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length];
      return `
        <div class="legend-item">
          <span class="legend-color" style="background: ${color.bg};"></span>
          <span><strong>No. ${c.ballot_number}:</strong> ${c.chair_name} & ${c.vice_name} (<strong>${c.vote_count}</strong> suara / <strong>${c.percentage}%</strong>)</span>
        </div>
      `;
    }).join('');
  }

  function renderCandidateRows(data, isClosed) {
    statsCandidatesContainer.classList.add('stats-candidates');
    statsCandidatesContainer.innerHTML = data.candidates.map((c, i) => {
      const isWinner = isClosed && data.winner_candidate_ids.includes(c.id) && data.result_status === 'decided';
      const isTie = isClosed && data.winner_candidate_ids.includes(c.id) && data.result_status === 'tie';
      const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length];

      return `
        <div class="candidate-stat-row ${isWinner ? 'winner-row' : ''}">
          ${isWinner ? `
            <div class="winner-crown-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              PEMENANG TERPILIH
            </div>
          ` : ''}
          ${isTie ? `
            <div class="winner-crown-badge" style="background: #d97706;">
              STATUS SERI (DRAW)
            </div>
          ` : ''}

          <img src="${c.photo_path}" class="stat-photo" onerror="this.src='https://placehold.co/100x100/142b4a/ffffff?text=Paslon+${c.ballot_number}'">

          <div class="stat-info">
            <span class="stat-ballot">Pasangan Calon Nomor Urut ${c.ballot_number}</span>
            <div class="stat-names">${c.chair_name} & ${c.vice_name}</div>
            <div class="stat-bar-wrapper">
              <div class="stat-bar-track">
                <div class="stat-bar-fill" style="width: ${c.percentage}%; background: ${isWinner ? '#f59e0b' : color.bg};">
                  ${c.percentage >= 15 ? `${c.percentage}%` : ''}
                </div>
              </div>
            </div>
          </div>

          <div class="stat-numbers">
            <div class="stat-count">${c.vote_count}</div>
            <div class="stat-pct">${c.percentage}% Suara</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Polling otomatis memastikan monitor berubah tanpa reload manual.
  setInterval(loadStatistics, 5000);

  // Countdown memakai timestamp dari server, sehingga semua monitor menghitung
  // menuju waktu yang sama dan refresh browser tidak mengatur ulang waktunya.
  setInterval(() => {
    if (!nextUpdateTimestamp) {
      systemCountdown.textContent = 'FINAL';
      return;
    }
    const remaining = Math.max(0, nextUpdateTimestamp - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    systemCountdown.textContent = `${minutes}:${seconds}`;
  }, 1000);

  document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
  });
})();
