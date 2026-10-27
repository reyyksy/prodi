// Logika Frontend Halaman Pemilih (Voter Client)
(function() {
  const API_BASE = '/api';

  // State
  let candidates = [];
  let selectedCandidateId = null;
  let currentPc = null;
  let currentSession = null;
  let electionStatus = 'draft';

  // DOM Elements
  const electionTitleHeading = document.getElementById('electionTitleHeading');
  const headerSchoolTitle = document.getElementById('headerSchoolTitle');
  const candidateList = document.getElementById('candidateList');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const pcIdentifierLabel = document.getElementById('pcIdentifierLabel');
  const selectedStatusText = document.getElementById('selectedStatusText');
  const btnOpenConfirmation = document.getElementById('btnOpenConfirmation');
  const bottomBar = document.getElementById('bottomBar');

  // Modals
  const detailModal = document.getElementById('detailModal');
  const btnCloseDetail = document.getElementById('btnCloseDetail');
  const btnModalCloseAction = document.getElementById('btnModalCloseAction');
  const btnModalSelectAction = document.getElementById('btnModalSelectAction');
  const modalCandidateTitle = document.getElementById('modalCandidateTitle');
  const modalVisionText = document.getElementById('modalVisionText');
  const modalMissionText = document.getElementById('modalMissionText');
  const modalProgramsList = document.getElementById('modalProgramsList');

  const confirmStage1Modal = document.getElementById('confirmStage1Modal');
  const confirmStage1BallotNum = document.getElementById('confirmStage1BallotNum');
  const confirmStage1Names = document.getElementById('confirmStage1Names');
  const btnCancelStage1 = document.getElementById('btnCancelStage1');
  const btnProceedToStage2 = document.getElementById('btnProceedToStage2');

  const confirmStage2Modal = document.getElementById('confirmStage2Modal');
  const btnCancelStage2 = document.getElementById('btnCancelStage2');
  const btnFinalSubmitVote = document.getElementById('btnFinalSubmitVote');

  const mainVotingView = document.getElementById('mainVotingView');
  const successView = document.getElementById('successView');
  const pcSetupOverlay = document.getElementById('pcSetupOverlay');
  const pcUnlockOverlay = document.getElementById('pcUnlockOverlay');
  const pcUnlockForm = document.getElementById('pcUnlockForm');
  const pcUnlockPassword = document.getElementById('pcUnlockPassword');
  const pcUnlockError = document.getElementById('pcUnlockError');

  let activeModalCandidateId = null;

  // Baca URL Param ?pc=
  const urlParams = new URLSearchParams(window.location.search);
  const pcParam = urlParams.get('pc');
  const isLocalMode = window.location.port === '3000' || window.location.port === '';

  // Inisialisasi
  async function init() {
    if (isLocalMode && !pcParam) {
      if (pcSetupOverlay) pcSetupOverlay.style.display = 'flex';
      return;
    }
    await fetchElectionStatus();
    await fetchPcInfo();
    if (currentSession && currentSession.session_status === 'completed') {
      showUnlockScreen();
      return;
    }
    await fetchCandidates();
    startPollingStatus();
  }

  function showUnlockScreen() {
    mainVotingView.style.display = 'none';
    bottomBar.style.display = 'none';
    successView.style.display = 'block';
    if (pcUnlockOverlay) pcUnlockOverlay.style.display = 'flex';
  }

  // 1. Ambil status pemilihan
  async function fetchElectionStatus() {
    try {
      const res = await fetch(`${API_BASE}/public/election-status`);
      const json = await res.json();
      if (json.success) {
        electionStatus = json.data.status;
        if (json.data.school_name) headerSchoolTitle.textContent = json.data.school_name;
        if (json.data.title) electionTitleHeading.textContent = json.data.title.toUpperCase();

        updateStatusUI();
      }
    } catch (e) {
      statusText.textContent = 'Server Offline / Tak Terhubung';
      statusDot.className = 'status-dot';
    }
  }

  function updateStatusUI() {
    statusDot.className = 'status-dot ' + (electionStatus === 'open' ? 'active' : (electionStatus === 'paused' ? 'paused' : 'closed'));
    if (electionStatus === 'open') {
      statusText.textContent = 'Pemilihan Dibuka';
    } else if (electionStatus === 'paused') {
      statusText.textContent = 'Pemilihan Dijeda Panitia';
    } else if (electionStatus === 'closed') {
      statusText.textContent = 'Pemilihan Telah Ditutup';
    } else {
      statusText.textContent = 'Pemilihan Belum Dibuka';
    }

    if (electionStatus !== 'open') {
      btnOpenConfirmation.disabled = true;
      btnOpenConfirmation.classList.remove('active');
    } else if (selectedCandidateId) {
      btnOpenConfirmation.disabled = false;
      btnOpenConfirmation.classList.add('active');
    }
  }

  // 2. Ambil PC info dan Sesi
  async function fetchPcInfo() {
    try {
      const url = pcParam ? `${API_BASE}/public/pc-info?pc=${pcParam}` : `${API_BASE}/public/pc-info`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        currentPc = json.data.pc;
        currentSession = json.data.session;

        pcIdentifierLabel.textContent = currentPc ? currentPc.display_name : 'PC Klien';

      }
    } catch (e) {
      console.warn('Gagal memuat status PC:', e);
    }
  }

  // 3. Ambil Kandidat
  async function fetchCandidates() {
    try {
      const res = await fetch(`${API_BASE}/candidates`);
      const json = await res.json();
      if (json.success) {
        candidates = json.data;
        renderCandidates();
      }
    } catch (e) {
      candidateList.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #dc2626; padding: 2rem;">Gagal terhubung ke server (${e.message}). Pastikan IP server di file js/ip.js telah sesuai.</div>`;
    }
  }

  function renderCandidates() {
    if (!candidates || candidates.length === 0) {
      candidateList.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Belum ada data kandidat aktif.</div>';
      return;
    }

    candidateList.innerHTML = candidates.map(c => `
      <div class="candidate-card ${selectedCandidateId === c.id ? 'selected' : ''}" id="card-cand-${c.id}">
        <div class="card-ballot-number">${c.ballot_number}</div>
        <div class="card-selected-ribbon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          PILIHAN ANDA
        </div>
        <div class="card-photo-wrapper">
          <img src="${c.photo_path}" alt="Paslon ${c.ballot_number}" onerror="this.src='https://placehold.co/600x400/142b4a/ffffff?text=Paslon+${c.ballot_number}'">
        </div>
        <div class="card-body">
          <div class="card-names">
            <div class="card-role-item">
              <span class="card-role-label">Calon Ketua Prodi</span>
              <div class="card-role-name">${c.chair_name}</div>
            </div>
            <div class="card-role-item">
              <span class="card-role-label">Calon Wakil Ketua</span>
              <div class="card-role-name">${c.vice_name}</div>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn-detail cursor-pointer" data-id="${c.id}" onclick="window.viewCandidateDetail(${c.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Lihat Visi, Misi & Proker
            </button>
            <button class="btn-select-candidate cursor-pointer" onclick="window.chooseCandidate(${c.id})">
              ${selectedCandidateId === c.id ? '✓ Paslon Terpilih' : 'Pilih Paslon Ini'}
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Handle Pilih Kandidat
  window.chooseCandidate = async function(id) {
    if (electionStatus !== 'open') {
      alert('Pemilihan belum dibuka atau sedang dijeda.');
      return;
    }

    selectedCandidateId = id;
    renderCandidates();

    const selected = candidates.find(c => c.id === id);
    if (selected) {
      selectedStatusText.innerHTML = `Pilihan: <strong>No. ${selected.ballot_number} (${selected.chair_name} & ${selected.vice_name})</strong>`;
      btnOpenConfirmation.disabled = false;
      btnOpenConfirmation.classList.add('active');

      // Update status sesi PC ke in_progress jika masih ready
      if (currentPc && currentSession && currentSession.session_status === 'ready') {
        try {
          await fetch(`${API_BASE}/public/pc-start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pc_id: currentPc.id })
          });
          currentSession.session_status = 'in_progress';
        } catch (e) {
          console.warn('Gagal set status PC:', e);
        }
      }
    }
  };

  // Handle Detail Modal
  window.viewCandidateDetail = function(id) {
    const c = candidates.find(item => item.id === id);
    if (!c) return;

    activeModalCandidateId = id;
    modalCandidateTitle.textContent = `Paslon No. ${c.ballot_number}: ${c.chair_name} & ${c.vice_name}`;
    modalVisionText.textContent = c.vision || '-';
    modalMissionText.textContent = c.mission || '-';

    modalProgramsList.innerHTML = '';
    if (c.programs && c.programs.length > 0) {
      c.programs.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p;
        modalProgramsList.appendChild(li);
      });
    } else {
      modalProgramsList.innerHTML = '<li>Belum ada program kerja tercatat.</li>';
    }

    detailModal.classList.add('active');
  };

  function closeDetailModal() {
    detailModal.classList.remove('active');
  }

  btnCloseDetail.addEventListener('click', closeDetailModal);
  btnModalCloseAction.addEventListener('click', closeDetailModal);
  btnModalSelectAction.addEventListener('click', () => {
    if (activeModalCandidateId) {
      window.chooseCandidate(activeModalCandidateId);
      closeDetailModal();
    }
  });

  // Konfirmasi 2 Tahap
  btnOpenConfirmation.addEventListener('click', () => {
    if (!selectedCandidateId || electionStatus !== 'open') return;

    const cand = candidates.find(c => c.id === selectedCandidateId);
    if (!cand) return;

    confirmStage1BallotNum.textContent = cand.ballot_number;
    confirmStage1Names.textContent = `${cand.chair_name} & ${cand.vice_name}`;

    confirmStage1Modal.classList.add('active');
  });

  btnCancelStage1.addEventListener('click', () => {
    confirmStage1Modal.classList.remove('active');
  });

  btnProceedToStage2.addEventListener('click', () => {
    confirmStage1Modal.classList.remove('active');
    confirmStage2Modal.classList.add('active');
  });

  btnCancelStage2.addEventListener('click', () => {
    confirmStage2Modal.classList.remove('active');
  });

  // Final Submit Suara ke Server
  btnFinalSubmitVote.addEventListener('click', async () => {
    if (!selectedCandidateId || !currentPc) {
      alert('Sesi PC tidak valid.');
      return;
    }

    btnFinalSubmitVote.disabled = true;
    btnFinalSubmitVote.textContent = 'Mengirim Suara ke Server...';

    try {
      const res = await fetch(`${API_BASE}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pc_id: currentPc.id,
          candidate_id: selectedCandidateId
        })
      });

      const json = await res.json();
      confirmStage2Modal.classList.remove('active');

      if (json.success) {
        showSuccessScreen();
      } else {
        alert('Gagal mengirim suara: ' + (json.message || 'Terjadi kesalahan sistem. Hubungi panitia.'));
        btnFinalSubmitVote.disabled = false;
        btnFinalSubmitVote.innerHTML = 'KIRIM SUARA SAH SAYA';
      }
    } catch (e) {
      confirmStage2Modal.classList.remove('active');
      alert('Status belum dipastikan karena kendala koneksi jaringan. Harap SEGERA lapor kepada panitia pengawas di ruangan!');
      btnFinalSubmitVote.disabled = false;
      btnFinalSubmitVote.innerHTML = 'KIRIM SUARA SAH SAYA';
    }
  });

  function showSuccessScreen() {
    mainVotingView.style.display = 'none';
    bottomBar.style.display = 'none';
    successView.style.display = 'block';

    // Anonimitas: Hapus jejak pilihan di memori client
    selectedCandidateId = null;
  }

  function startPollingStatus() {
    setInterval(async () => {
      // Jika sudah di success view, periksa apakah sesi sudah di-reset admin
      if (successView.style.display !== 'block') {
        fetchElectionStatus();
      }
    }, 4000);
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);

  if (pcUnlockForm) {
    pcUnlockForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      pcUnlockError.textContent = '';
      const submit = pcUnlockForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/public/pc-unlock`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pc_id: currentPc && currentPc.id, password: pcUnlockPassword.value })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        window.location.reload();
      } catch (error) {
        pcUnlockError.textContent = error.message || 'Password petugas salah.';
        submit.disabled = false;
      }
    });
  }
})();
