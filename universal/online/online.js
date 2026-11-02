(function () {
  const tokenKey = 'online_vote_token';
  const loginView = document.getElementById('loginView');
  const voteView = document.getElementById('voteView');
  const message = document.getElementById('loginMessage');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const voteMessage = document.getElementById('voteMessage');
  const list = document.getElementById('candidateList');
  let token = sessionStorage.getItem(tokenKey);

  async function api(url, options = {}) {
    options.headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api/online${url}`, options);
    const body = await res.text();
    let data;
    try { data = JSON.parse(body); } catch (error) {
      return { success: false, message: `Server mengirim respons tidak valid (HTTP ${res.status}).` };
    }
    if (!res.ok && !data.message) data.message = `Login gagal (HTTP ${res.status}).`;
    return data;
  }

  async function showCandidates() {
    const status = await (await fetch('/api/public/election-status')).json();
    if (!status.success || status.data.status !== 'open') { voteMessage.textContent = 'Pemilihan online belum dibuka atau sedang dijeda.'; return; }
    const result = await (await fetch('/api/candidates')).json();
    list.innerHTML = result.data.map(c => `<article class="candidate-card"><img src="${c.photo_path}" alt="Paslon ${c.ballot_number}"><div class="card-body"><h3>Paslon ${c.ballot_number}</h3><p><strong>${c.chair_name}</strong> & ${c.vice_name}</p><button class="btn-select-candidate" data-id="${c.id}">Pilih Paslon Ini</button></div></article>`).join('');
    list.querySelectorAll('[data-id]').forEach(button => button.onclick = async () => {
      if (!confirm('Pastikan pilihan Anda benar. Lanjutkan?')) return;
      button.disabled = true;
      const result = await api('/vote', { method: 'POST', body: JSON.stringify({ candidate_id: Number(button.dataset.id) }) });
      voteMessage.textContent = result.message;
      if (result.success) { token = null; sessionStorage.removeItem(tokenKey); list.innerHTML = ''; }
      button.disabled = false;
    });
  }

  document.getElementById('loginButton').onclick = async () => {
    const button = document.getElementById('loginButton');
    if (!usernameInput.value.trim() || !passwordInput.value) { message.textContent = 'ID/username dan password wajib diisi.'; return; }
    button.disabled = true;
    button.textContent = 'Memeriksa...';
    let result;
    try {
      result = await api('/login', { method: 'POST', body: JSON.stringify({ identifier: usernameInput.value.trim(), password: passwordInput.value }) });
    } catch (error) {
      result = { success: false, message: 'Backend online tidak terhubung. Pastikan npm start sedang berjalan.' };
    }
    message.textContent = result.success ? '' : (result.message || 'ID, username, atau password salah.');
    if (result.success) { token = result.token; sessionStorage.setItem(tokenKey, token); loginView.style.display = 'none'; voteView.style.display = 'block'; await showCandidates(); }
    button.disabled = false;
    button.textContent = 'Masuk dan Lanjut Memilih';
  };
})();
