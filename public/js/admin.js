// Logika Frontend Admin Dashboard
(function() {
  const API_BASE = '/api';

  // Elements
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const inputUsername = document.getElementById('inputUsername');
  const inputPassword = document.getElementById('inputPassword');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');
  const adminUsernameBadge = document.getElementById('adminUsernameBadge');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const currentTabTitle = document.getElementById('currentTabTitle');

  // Status & Safety Banners
  const serverStatusPill = document.getElementById('serverStatusPill');
  const serverStatusDot = document.getElementById('serverStatusDot');
  const serverStatusText = document.getElementById('serverStatusText');
  const serverOfflineBanner = document.getElementById('serverOfflineBanner');
  const serverOnlineOpenBanner = document.getElementById('serverOnlineOpenBanner');
  const serverOnlinePausedBanner = document.getElementById('serverOnlinePausedBanner');
  const openBannerPort = document.getElementById('openBannerPort');
  const safetyRecoveryBanner = document.getElementById('safetyRecoveryBanner');
  const btnDismissRecoveryBanner = document.getElementById('btnDismissRecoveryBanner');

  // Tabs & Nav
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Control buttons
  const btnCtrlStart = document.getElementById('btnCtrlStart');
  const btnCtrlPause = document.getElementById('btnCtrlPause');
  const btnCtrlStop = document.getElementById('btnCtrlStop');
  const btnCtrlReset = document.getElementById('btnCtrlReset');

  // App Object
  const adminApp = {
    currentUser: null,
    pollingInterval: null,
    healthInterval: null,
    isServerOnline: false,

    async init() {
      this.setupNav();
      this.setupEvents();
      await this.checkHealth();
      await this.checkAuth();
      this.startHealthMonitoring();
    },

    async checkHealth() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          this.isServerOnline = true;
          serverOfflineBanner.style.display = 'none';

          const d = json.data;
          const uptimeMinutes = Math.floor((d.uptime_seconds || 0) / 60);

          if (openBannerPort) openBannerPort.textContent = d.port || '3000';

          // Tampilkan status dengan teks dan banner deskriptif yang sangat jelas
          if (d.election_status === 'open') {
            serverStatusDot.className = 'status-dot active';
            serverStatusText.innerHTML = `<span style="color: #15803d; font-weight: 700;">🟢 Server Hidup • Pemilihan Buka (OPEN)</span>`;
            if (serverOnlineOpenBanner) serverOnlineOpenBanner.style.display = 'block';
            if (serverOnlinePausedBanner) serverOnlinePausedBanner.style.display = 'none';
          } else if (d.election_status === 'paused') {
            serverStatusDot.className = 'status-dot paused';
            serverStatusText.innerHTML = `<span style="color: #b45309; font-weight: 700;">🟠 Server Hidup • Pemilihan Dijeda (PAUSED)</span>`;
            if (serverOnlineOpenBanner) serverOnlineOpenBanner.style.display = 'none';
            if (serverOnlinePausedBanner) serverOnlinePausedBanner.style.display = 'block';
          } else if (d.election_status === 'closed') {
            serverStatusDot.className = 'status-dot closed';
            serverStatusText.innerHTML = `<span style="color: #b91c1c; font-weight: 700;">🔴 Server Hidup • Pemilihan Ditutup (CLOSED)</span>`;
            if (serverOnlineOpenBanner) serverOnlineOpenBanner.style.display = 'none';
            if (serverOnlinePausedBanner) serverOnlinePausedBanner.style.display = 'none';
          } else {
            serverStatusDot.className = 'status-dot';
            serverStatusText.innerHTML = `<span style="color: #475569; font-weight: 700;">⚪ Server Hidup • DRAFT (${uptimeMinutes}m)</span>`;
            if (serverOnlineOpenBanner) serverOnlineOpenBanner.style.display = 'none';
            if (serverOnlinePausedBanner) serverOnlinePausedBanner.style.display = 'none';
          }

          // Cek apakah baru saja pulih dari mati lampu / restart
          if (d.was_recovered && !sessionStorage.getItem('recovery_dismissed')) {
            safetyRecoveryBanner.style.display = 'block';
          }
        } else {
          this.handleServerOffline();
        }
      } catch (e) {
        this.handleServerOffline();
      }
    },

    handleServerOffline() {
      this.isServerOnline = false;
      serverStatusDot.className = 'status-dot closed';
      serverStatusText.innerHTML = `<span style="color: #dc2626; font-weight: 700;">❌ Server Belum Jalan / Mati (OFFLINE)</span>`;
      serverOfflineBanner.style.display = 'block';
      if (serverOnlineOpenBanner) serverOnlineOpenBanner.style.display = 'none';
      if (serverOnlinePausedBanner) serverOnlinePausedBanner.style.display = 'none';
    },

    startHealthMonitoring() {
      if (this.healthInterval) clearInterval(this.healthInterval);
      this.healthInterval = setInterval(() => {
        this.checkHealth();
      }, 3500);
    },

    async checkAuth() {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
          this.currentUser = json.user;
          adminUsernameBadge.textContent = this.currentUser.username;
          loginOverlay.style.display = 'none';
          this.loadDashboard();
          this.startPolling();
        } else {
          loginOverlay.style.display = 'flex';
        }
      } catch (e) {
        loginOverlay.style.display = 'flex';
      }
    },

    setupNav() {
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          const targetTab = item.getAttribute('data-tab');
          navItems.forEach(n => n.classList.remove('active'));
          tabPanes.forEach(p => p.classList.remove('active'));

          item.classList.add('active');
          const activePane = document.getElementById(targetTab);
          if (activePane) activePane.classList.add('active');

          currentTabTitle.textContent = item.textContent.trim();

          // Refresh per tab
          if (targetTab === 'tabDashboard') adminApp.loadDashboard();
          if (targetTab === 'tabMonitoring') adminApp.loadPcMonitoring();
          if (targetTab === 'tabCandidates') adminApp.loadCandidates();
          if (targetTab === 'tabStatistics') adminApp.loadStatistics();
          if (targetTab === 'tabSettings') adminApp.loadSettings();
          if (targetTab === 'tabBackup') adminApp.loadBackupsAndExports();
          if (targetTab === 'tabAudit') adminApp.loadAuditLogs();
        });
      });
    },

    setupEvents() {
      const btnRefreshStatistics = document.getElementById('btnRefreshStatistics');
      if (btnRefreshStatistics) {
        btnRefreshStatistics.addEventListener('click', () => this.refreshStatistics());
      }

      const btnResetAllPc = document.getElementById('btnResetAllPc');
      if (btnResetAllPc) btnResetAllPc.addEventListener('click', () => this.resetAllPc());

      // Dismiss Recovery Banner
      if (btnDismissRecoveryBanner) {
        btnDismissRecoveryBanner.addEventListener('click', () => {
          safetyRecoveryBanner.style.display = 'none';
          sessionStorage.setItem('recovery_dismissed', 'true');
        });
      }

      // Login
      btnSubmitLogin.addEventListener('click', async () => {
        const username = inputUsername.value.trim();
        const password = inputPassword.value.trim();
        if (!username || !password) return;

        loginErrorMsg.style.display = 'none';
        btnSubmitLogin.disabled = true;
        btnSubmitLogin.textContent = 'Memverifikasi...';

        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
          });
          const json = await res.json();
          btnSubmitLogin.disabled = false;
          btnSubmitLogin.textContent = 'Masuk ke Dashboard';

          if (json.success) {
            adminApp.checkAuth();
          } else {
            loginErrorMsg.textContent = json.message || 'Login gagal';
            loginErrorMsg.style.display = 'block';
          }
        } catch (e) {
          btnSubmitLogin.disabled = false;
          btnSubmitLogin.textContent = 'Masuk ke Dashboard';
          loginErrorMsg.textContent = 'Gagal menghubungi server. Pastikan server sudah dijalankan di terminal.';
          loginErrorMsg.style.display = 'block';
        }
      });

      // Logout
      btnAdminLogout.addEventListener('click', async () => {
        if (!confirm('Apakah Anda yakin ingin keluar dari panel admin?')) return;
        try {
          await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
          window.location.reload();
        } catch (e) {
          window.location.reload();
        }
      });

      // Controls
      btnCtrlStart.addEventListener('click', async () => {
        if (!confirm('Apakah Anda yakin ingin MEMBUKA pemilihan suara sekarang?')) return;
        await adminApp.postAction('/admin/election/start');
        adminApp.loadDashboard();
        adminApp.checkHealth();
      });

      btnCtrlPause.addEventListener('click', async () => {
        if (!confirm('Apakah Anda ingin MENJEDA sementara proses pemilihan?')) return;
        await adminApp.postAction('/admin/election/pause');
        adminApp.loadDashboard();
        adminApp.checkHealth();
      });

      btnCtrlStop.addEventListener('click', async () => {
        const pass = prompt('PERINGATAN: Aksi ini akan MENUTUP pemilihan secara FINAL. Masukkan password admin untuk konfirmasi:');
        if (!pass) return;
        await adminApp.postAction('/admin/election/stop', { password: pass });
        adminApp.loadDashboard();
        adminApp.checkHealth();
      });

      btnCtrlReset.addEventListener('click', async () => {
        const phrase = prompt('PERINGATAN KERAS: Aksi ini akan menghapus semua suara (backup otomatis akan dibuat). Ketik frasa "RESET-PEMILIHAN-TJKT":');
        if (phrase !== 'RESET-PEMILIHAN-TJKT') {
          alert('Frasa konfirmasi salah. Reset dibatalkan.');
          return;
        }
        const pass = prompt('Masukkan password admin untuk verifikasi akhir:');
        if (!pass) return;
        await adminApp.postAction('/admin/election/reset', { confirmation_phrase: phrase, password: pass });
        adminApp.loadDashboard();
        adminApp.checkHealth();
      });

      // Settings
      const btnSaveSettings = document.getElementById('btnSaveSettings');
      if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', async () => {
          const school_name = document.getElementById('settingSchoolName').value;
          const election_title = document.getElementById('settingElectionTitle').value;
          const academic_year = document.getElementById('settingAcademicYear').value;

          try {
            const res = await fetch(`${API_BASE}/admin/settings`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ school_name, election_title, academic_year })
            });
            const json = await res.json();
            alert(json.message);
          } catch (e) {
            alert('Gagal menyimpan: ' + e.message);
          }
        });
      }

      // Password Change
      const btnSavePassword = document.getElementById('btnSavePassword');
      if (btnSavePassword) {
        btnSavePassword.addEventListener('click', async () => {
          const current_password = document.getElementById('inputCurrentPass').value;
          const new_password = document.getElementById('inputNewPass').value;
          const confirm = document.getElementById('inputConfirmPass').value;

          if (new_password !== confirm) {
            alert('Konfirmasi password baru tidak cocok!');
            return;
          }

          try {
            const res = await fetch(`${API_BASE}/admin/password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ current_password, new_password })
            });
            const json = await res.json();
            alert(json.message);
            if (json.success) {
              document.getElementById('changePasswordForm').reset();
            }
          } catch (e) {
            alert('Gagal: ' + e.message);
          }
        });
      }

      // Excel export
      const btnGenerateExcel = document.getElementById('btnGenerateExcel');
      if (btnGenerateExcel) {
        btnGenerateExcel.addEventListener('click', async () => {
          btnGenerateExcel.disabled = true;
          btnGenerateExcel.textContent = 'Membuat Laporan Excel...';
          try {
            const res = await fetch(`${API_BASE}/admin/exports/generate`, { method: 'POST', credentials: 'include' });
            const json = await res.json();
            alert(json.message);
            adminApp.loadBackupsAndExports();
          } catch (e) {
            alert('Gagal membuat ekspor: ' + e.message);
          }
          btnGenerateExcel.disabled = false;
          btnGenerateExcel.textContent = 'Generate Laporan Excel Sekarang';
        });
      }

      // Manual Backup
      const btnManualBackup = document.getElementById('btnManualBackup');
      if (btnManualBackup) {
        btnManualBackup.addEventListener('click', async () => {
          btnManualBackup.disabled = true;
          btnManualBackup.textContent = 'Membuat Backup Database...';
          try {
            const res = await fetch(`${API_BASE}/admin/backup`, { method: 'POST', credentials: 'include' });
            const json = await res.json();
            alert(json.message);
            adminApp.loadBackupsAndExports();
          } catch (e) {
            alert('Gagal: ' + e.message);
          }
          btnManualBackup.disabled = false;
          btnManualBackup.textContent = 'Buat Backup Database Baru (.sqlite)';
        });
      }
    },

    async postAction(endpoint, payload = {}) {
      try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        alert(json.message);
        return json;
      } catch (e) {
        alert('Gagal memproses tindakan: ' + e.message);
      }
    },

    // 1. Dashboard data
    async loadDashboard() {
      try {
        const res = await fetch(`${API_BASE}/admin/overview`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
          const d = json.data;
          document.getElementById('dashElectionStatus').textContent = d.election_status.toUpperCase();
          document.getElementById('dashTotalVotes').textContent = d.total_votes;
          document.getElementById('dashTotalCandidates').textContent = d.total_candidates;

          const readyCount = d.pc_devices.filter(p => p.session_status === 'ready').length;
          document.getElementById('dashPcReadyCount').textContent = `${readyCount} / ${d.pc_devices.length}`;

          this.renderPcGrid(d.pc_devices, document.getElementById('dashPcGrid'));

          // Recent Logs
          const tbody = document.getElementById('dashRecentLogsTbody');
          if (d.recent_logs && d.recent_logs.length > 0) {
            tbody.innerHTML = d.recent_logs.map(l => `
              <tr>
                <td>${new Date(l.created_at).toLocaleTimeString('id-ID')}</td>
                <td><span style="font-weight: 600; font-family: var(--font-mono);">${l.action}</span></td>
                <td>${l.details || '-'}</td>
                <td>${l.admin_username || 'SYSTEM'}</td>
              </tr>
            `).join('');
          } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">Belum ada aktivitas.</td></tr>';
          }
        }
      } catch (e) {
        console.warn('Dashboard error:', e);
      }
    },

    // 2. Monitoring PC
    async loadPcMonitoring() {
      try {
        const res = await fetch(`${API_BASE}/admin/pc-devices`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
          this.renderPcGrid(json.data, document.getElementById('monitoringPcGrid'));
        }
      } catch (e) {
        console.warn('PC Monitor error:', e);
      }
    },

    renderPcGrid(pcs, container) {
      if (!container) return;
      container.innerHTML = pcs.map(p => {
        const st = p.session_status || 'ready';
        let label = 'Siap Memilih';
        if (st === 'in_progress') label = 'Sedang Memilih';
        if (st === 'completed') label = 'Selesai (sesi berikutnya otomatis siap)';

        return `
          <div class="pc-card">
            <div class="pc-card-header">
              <div class="pc-name">${p.display_name}</div>
              <span class="pc-status-badge ${st}">${label}</span>
            </div>
            <div class="pc-ip-meta">
              Jumlah pemungutan dari PC ini: ${p.vote_count || 0}<br>
              <a href="/index.html?pc=${p.pc_number}" target="_blank" style="color: var(--color-teal); text-decoration: none; font-size: 0.75rem;">
                🔗 Buka Layar Bilik PC #${p.pc_number}
              </a>
            </div>
            <div class="pc-actions">
              <button class="btn-prepare-pc cursor-pointer" onclick="window.adminApp.resetPc(${p.id})">Reset PC ini</button>
            </div>
          </div>
        `;
      }).join('');
    },

    async preparePc(pcId) {
      try {
        const res = await fetch(`${API_BASE}/admin/pc-devices/${pcId}/prepare-next-voter`, {
          method: 'POST',
          credentials: 'include'
        });
        const json = await res.json();
        alert(json.message);
        this.loadPcMonitoring();
        this.loadDashboard();
      } catch (e) {
        alert('Gagal menyiapkan PC: ' + e.message);
      }
    },

    async resetPc(pcId) {
      if (!confirm('Reset PC ini agar siap untuk pemilih berikutnya? Suara yang sudah masuk tetap aman.')) return;
      try {
        const res = await fetch(`${API_BASE}/admin/pc-devices/${pcId}/reset`, { method: 'POST', credentials: 'include' });
        const json = await res.json();
        alert(json.message);
        if (json.success) { this.loadPcMonitoring(); this.loadDashboard(); }
      } catch (e) { alert('Gagal me-reset PC: ' + e.message); }
    },

    async resetAllPc() {
      if (!confirm('Reset SEMUA PC agar siap untuk pemilih berikutnya? Suara yang sudah masuk tetap aman.')) return;
      try {
        const res = await fetch(`${API_BASE}/admin/pc-devices/reset-all`, { method: 'POST', credentials: 'include' });
        const json = await res.json();
        alert(json.message);
        if (json.success) { this.loadPcMonitoring(); this.loadDashboard(); }
      } catch (e) { alert('Gagal me-reset semua PC: ' + e.message); }
    },

    async refreshAllPc() {
      try {
        const res = await fetch(`${API_BASE}/admin/pc-devices/refresh-all`, { method: 'POST', credentials: 'include' });
        const json = await res.json();
        alert(json.message);
        if (json.success) this.loadPcMonitoring();
      } catch (e) { alert('Gagal mengirim perintah refresh: ' + e.message); }
    },

    // 3. Candidates
    async loadCandidates() {
      try {
        const res = await fetch(`${API_BASE}/admin/candidates`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
          const tbody = document.getElementById('candidatesTableTbody');
          tbody.innerHTML = json.data.map(c => `
            <tr>
              <td style="font-weight: 700; font-size: 1.1rem; text-align: center;">${c.ballot_number}</td>
              <td><img src="${c.photo_path}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;"></td>
              <td>
                <strong>Ketua:</strong> ${c.chair_name}<br>
                <strong>Wakil:</strong> ${c.vice_name}
              </td>
              <td style="max-width: 300px;">
                <strong>Visi:</strong> ${c.vision}<br>
                <strong style="margin-top: 4px; display: inline-block;">Misi:</strong> ${c.mission}
              </td>
              <td>
                <ul style="padding-left: 1.2rem; margin: 0;">
                  ${(c.programs || []).map(p => `<li>${p}</li>`).join('')}
                </ul>
              </td>
            </tr>
          `).join('');
        }
      } catch (e) {}
    },

    // 4. Statistics in Admin
    async loadStatistics() {
      try {
        const res = await fetch(`${API_BASE}/statistics`);
        const json = await res.json();
        if (json.success) {
          const container = document.getElementById('adminStatsContainer');
          const d = json.data;

          container.innerHTML = `
            <div style="margin-bottom: 1.5rem; font-size: 1.1rem;">
              Total Suara Terhimpun: <strong>${d.total_votes}</strong>
            </div>
            ${d.candidates.map(c => `
              <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem; font-weight: 600;">
                  <span>No. ${c.ballot_number} - ${c.chair_name} & ${c.vice_name}</span>
                  <span>${c.vote_count} Suara (${c.percentage}%)</span>
                </div>
                <div class="vote-bar-bg">
                  <div class="vote-bar-fill ${d.winner_candidate_ids.includes(c.id) ? 'winner' : ''}" style="width: ${c.percentage}%"></div>
                </div>
              </div>
            `).join('')}
          `;
          const source = await (await fetch(`${API_BASE}/admin/online-overview`, { credentials: 'include' })).json();
          if (source.success) {
            const s = source.data;
            document.getElementById('sourceStatsContainer').innerHTML = `
              <h3 style="margin-bottom:1rem">Rekap Sumber Pemungutan</h3>
              <div class="stats-overview-grid">
                <div class="stat-metric-card"><div class="stat-metric-label">Total Gabungan</div><div class="stat-metric-value">${s.total_votes}</div></div>
                <div class="stat-metric-card"><div class="stat-metric-label">Total Lokal / PC</div><div class="stat-metric-value">${s.local_votes}</div></div>
                <div class="stat-metric-card"><div class="stat-metric-label">Total Online</div><div class="stat-metric-value">${s.online_votes}</div></div>
              </div>
              <h4 style="margin:1rem 0 .5rem">Jumlah Suara Lokal per PC</h4>
              <div class="data-table-container"><table class="data-table"><thead><tr><th>PC</th><th>Jumlah Pemungutan</th></tr></thead><tbody>${s.pc_votes.map(p => `<tr><td>${p.display_name} (PC ${p.pc_number})</td><td>${p.vote_count}</td></tr>`).join('')}</tbody></table></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin:1.5rem 0 .5rem;gap:1rem;flex-wrap:wrap"><h4>Status Akun Online</h4><button class="btn-danger cursor-pointer" id="btnResetOnlineClients" style="padding:.55rem .85rem">Reset Status Akun Online</button></div>
              <div class="data-table-container"><table class="data-table"><thead><tr><th>ID</th><th>Username</th><th>Status</th><th>Waktu</th></tr></thead><tbody>${s.online_clients.map(c => `<tr><td>${c.id}</td><td>${c.username}</td><td>${c.has_voted ? 'Sudah memilih' : 'Belum memilih'}</td><td>${c.voted_at ? new Date(c.voted_at).toLocaleString('id-ID') : '-'}</td></tr>`).join('')}</tbody></table></div>
            `;
            document.getElementById('btnResetOnlineClients').addEventListener('click', async () => {
              if (!confirm('Reset semua akun online ke status BELUM MEMILIH? Suara yang sudah masuk tidak dihapus.')) return;
              const password = prompt('Masukkan password admin untuk konfirmasi reset akun online:');
              if (!password) return;
              const reset = await fetch(`${API_BASE}/admin/online/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ password }) });
              const result = await reset.json();
              alert(result.message || 'Reset selesai.');
              if (result.success) this.loadStatistics();
            });
          }
        }
      } catch (e) {}
    },

    async refreshStatistics() {
      const button = document.getElementById('btnRefreshStatistics');
      if (!button) return;
      if (!confirm('Perbarui statistik sekarang dan mulai ulang hitung mundur 5 menit untuk semua halaman?')) return;
      const original = button.innerHTML;
      button.disabled = true;
      button.textContent = 'Memperbarui...';
      try {
        const res = await fetch(`${API_BASE}/admin/statistics/refresh`, {
          method: 'POST', credentials: 'include'
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message || 'Gagal memperbarui statistik');
        alert(result.message);
        await this.loadStatistics();
      } catch (e) {
        alert(e.message || 'Gagal memperbarui statistik.');
      } finally {
        button.disabled = false;
        button.innerHTML = original;
      }
    },

    // 5. Settings
    async loadSettings() {
      try {
        const res = await fetch(`${API_BASE}/admin/settings`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
          document.getElementById('settingSchoolName').value = json.data.school_name || '';
          document.getElementById('settingElectionTitle').value = json.data.election_title || '';
          document.getElementById('settingAcademicYear').value = json.data.academic_year || '';
        }
      } catch (e) {}
    },

    // 6. Backups & Exports
    async loadBackupsAndExports() {
      // Excel exports
      try {
        const res = await fetch(`${API_BASE}/admin/exports`, { credentials: 'include' });
        const json = await res.json();
        const tbody = document.getElementById('excelExportsTbody');
        if (json.success && json.data.length > 0) {
          tbody.innerHTML = json.data.map(f => `
            <tr>
              <td style="font-family: var(--font-mono);">${f.filename}</td>
              <td>${(f.size / 1024).toFixed(1)} KB</td>
              <td>${new Date(f.created_at).toLocaleString('id-ID')}</td>
              <td>
                <a href="${API_BASE}/admin/exports/${encodeURIComponent(f.filename)}/download" target="_blank" class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; text-decoration: none;">
                  Unduh File
                </a>
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="4" style="color: #94a3b8;">Belum ada laporan excel yang digenerate.</td></tr>';
        }
      } catch (e) {}

      // Sqlite backups
      try {
        const res = await fetch(`${API_BASE}/admin/backups`, { credentials: 'include' });
        const json = await res.json();
        const tbody = document.getElementById('backupsListTbody');
        if (json.success && json.data.length > 0) {
          tbody.innerHTML = json.data.map(b => `
            <tr>
              <td style="font-family: var(--font-mono);">${b.filename}</td>
              <td>${(b.size / 1024).toFixed(1)} KB</td>
              <td>${new Date(b.created_at).toLocaleString('id-ID')}</td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="3" style="color: #94a3b8;">Belum ada arsip backup.</td></tr>';
        }
      } catch (e) {}
    },

    // 7. Audit logs
    async loadAuditLogs() {
      try {
        const res = await fetch(`${API_BASE}/admin/audit-logs`, { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
          const tbody = document.getElementById('fullAuditLogsTbody');
          tbody.innerHTML = json.data.map(l => `
            <tr>
              <td>${new Date(l.created_at).toLocaleString('id-ID')}</td>
              <td><span style="font-weight: 600; font-family: var(--font-mono);">${l.action}</span></td>
              <td>${l.admin_username || 'SYSTEM'}</td>
              <td style="font-family: var(--font-mono); font-size: 0.8rem;">${l.ip_address || '-'}</td>
              <td>${l.details || '-'}</td>
            </tr>
          `).join('');
        }
      } catch (e) {}
    },

    startPolling() {
      if (this.pollingInterval) clearInterval(this.pollingInterval);
      this.pollingInterval = setInterval(() => {
        const activeTab = document.querySelector('.nav-item.active')?.getAttribute('data-tab');
        if (activeTab === 'tabDashboard') this.loadDashboard();
        if (activeTab === 'tabMonitoring') this.loadPcMonitoring();
      }, 3000);
    }
  };

  window.adminApp = adminApp;
  document.addEventListener('DOMContentLoaded', () => adminApp.init());
})();
