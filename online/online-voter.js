(function () {
  const tokenKey = 'online_vote_token';
  let token = sessionStorage.getItem(tokenKey);
  const originalFetch = window.fetch.bind(window);
  const overlay = document.createElement('div');
  overlay.id = 'onlineLoginOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(15,23,42,.66);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:2rem;max-width:440px;width:100%;box-shadow:0 20px 40px #0004"><div style="text-align:center;font-size:2rem">🗳️</div><h2 style="text-align:center;color:#142b4a;margin:.5rem 0">Login Pemilih Online</h2><p style="text-align:center;color:#475569">Masukkan ID atau username dan password dari panitia.</p><label>ID / Username</label><input id="onlineLoginId" style="width:100%;padding:.75rem;margin:.35rem 0 1rem;border:1px solid #e2e8f0;border-radius:8px"><label>Password</label><input id="onlineLoginPassword" type="password" style="width:100%;padding:.75rem;margin:.35rem 0 1rem;border:1px solid #e2e8f0;border-radius:8px"><button id="onlineLoginButton" style="width:100%;padding:.8rem;background:#142b4a;color:#fff;border:0;border-radius:8px;font-weight:700">Masuk dan Lanjut Memilih</button><p id="onlineLoginMessage" style="min-height:1.5rem;color:#b91c1c;text-align:center"></p><button id="onlineStatsButton" style="width:100%;padding:.7rem;border:1px solid #0d9488;border-radius:8px;background:#fff;color:#0f766e;font-weight:700;cursor:pointer">Lihat Statistik Sementara</button></div>`;
  document.body.appendChild(overlay);
  document.getElementById('onlineStatsButton').onclick = () => { window.location.href = '/statistik.html'; };

  function addStatisticsButton(target) {
    if (target.querySelector('.online-statistics-button')) return;
    const button = document.createElement('button');
    button.className = 'online-statistics-button';
    button.textContent = 'Lihat Statistik Sementara';
    button.style.cssText = 'display:block;width:100%;margin-top:1rem;padding:.75rem;border:1px solid #0d9488;border-radius:8px;background:#fff;color:#0f766e;font-weight:700;cursor:pointer;';
    button.onclick = () => { window.location.href = '/statistik.html'; };
    target.appendChild(button);
  }

  window.fetch = async function (input, options = {}) {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/votes')) {
      const body = JSON.parse(options.body || '{}');
      options.headers = { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token || ''}` };
      const response = await originalFetch('/api/online/vote', { ...options, body: JSON.stringify({ candidate_id: body.candidate_id }) });
      if (response.ok) {
        const result = await response.clone().json().catch(() => null);
        if (result && result.success) setTimeout(() => addStatisticsButton(document.getElementById('successView')), 50);
      }
      return response;
    }
    return originalFetch(input, options);
  };

  document.getElementById('onlineLoginButton').onclick = async () => {
    const button = document.getElementById('onlineLoginButton');
    const message = document.getElementById('onlineLoginMessage');
    const identifier = document.getElementById('onlineLoginId').value.trim();
    const password = document.getElementById('onlineLoginPassword').value;
    if (!identifier || !password) { message.textContent = 'ID/username dan password wajib diisi.'; return; }
    button.disabled = true; button.textContent = 'Memeriksa...';
    try {
      const response = await originalFetch('/api/online/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) });
      const result = await response.json();
      if (!result.success) {
        message.textContent = result.message || 'ID, username, atau password salah.';
        if ((result.message || '').toLowerCase().includes('sudah')) addStatisticsButton(message.parentElement);
      }
      else { token = result.token; sessionStorage.setItem(tokenKey, token); overlay.remove(); }
    } catch (error) { message.textContent = 'Backend belum terhubung. Pastikan npm start berjalan.'; }
    button.disabled = false; button.textContent = 'Masuk dan Lanjut Memilih';
  };
})();
