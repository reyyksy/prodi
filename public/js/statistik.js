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
  const btnManualRefresh = document.getElementById('btnManualRefresh');

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
      statsCandidatesContainer.innerHTML = `<div style="text-align: center; color: #dc2626; padding: 2rem;">Gagal memuat data statistik: ${e.message}</div>`;
    }
  }

  function renderStatistics(data) {
    const isClosed = data.election_status === 'closed';
    statsTotalVotes.textContent = data.total_votes;

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
      statsSubtitle.textContent = 'Data perolehan suara terproteksi dan teragregasi secara otomatis dan anonim.';
      finalStatusAlert.style.display = 'none';
    }

    // 1. Render Diagram Perbandingan Batang Horizontal Terpadu (Stacked Bar)
    renderStackedComparisonBar(data);

    // 2. Render Baris Kartu Paslon Vertikal dengan Progress Bar Individual
    renderCandidateRows(data, isClosed);
  }

  function renderStackedComparisonBar(data) {
    const total = data.total_votes;
    if (total === 0) {
      stackedBarContainer.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 0.85rem; font-weight: 500;">
          Belum ada suara masuk untuk digambarkan pada diagram
        </div>
      `;
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

    // Segmen batang stacked
    stackedBarContainer.innerHTML = data.candidates.map((c, i) => {
      const color = CANDIDATE_COLORS[i % CANDIDATE_COLORS.length];
      const pct = c.percentage;
      if (pct <= 0) return '';
      return `
        <div class="stacked-segment" style="width: ${pct}%; background: ${color.bg};" title="Paslon ${c.ballot_number}: ${c.vote_count} Suara (${pct}%)">
          ${pct >= 10 ? `No. ${c.ballot_number} (${pct}%)` : (pct >= 5 ? `${pct}%` : '')}
        </div>
      `;
    }).join('');

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

  btnManualRefresh.addEventListener('click', async () => {
    btnManualRefresh.disabled = true;
    btnManualRefresh.textContent = 'Menyinkronkan...';
    try {
      const res = await fetch(`${API_BASE}/public/statistics/refresh`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        renderStatistics(json.data);
      }
    } catch (e) {
      alert('Gagal menyinkronkan data.');
    }
    btnManualRefresh.disabled = false;
    btnManualRefresh.textContent = 'Sinkronkan Sekarang';
  });

  document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
  });
})();
