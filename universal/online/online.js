(function () {
  const tokenKey = 'online_vote_token';
  const searchStep = document.getElementById('searchStep');
  const passwordStep = document.getElementById('passwordStep');
  const voteStep = document.getElementById('voteStep');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const passwordInput = document.getElementById('passwordInput');
  const loginMessage = document.getElementById('loginMessage');
  const selectedUser = document.getElementById('selectedUser');
  const voteMessage = document.getElementById('voteMessage');
  const list = document.getElementById('candidateList');
  let selectedClient = null;
  let token = sessionStorage.getItem(tokenKey);
  const show = step => [searchStep, passwordStep, voteStep].forEach(item => item.classList.toggle('active', item === step));
  async function api(url, options = {}) {
    options.headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api/online${url}`, options);
    return res.json();
  }
  async function searchClients() {
    const query = new URLSearchParams({ q: searchInput.value.trim() });
    const result = await api(`/clients/search?${query}`);
    searchResults.innerHTML = result.data?.length ? result.data.map(c => c.has_voted
      ? `<div class="online-user" style="opacity:.7"><span><strong>${c.username}</strong><br><small>${c.major || '-'} · ${c.class_name || '-'}</small></span><strong style="color:var(--color-danger);font-size:.8rem">Sudah memilih</strong></div>`
      : `<button class="online-user" type="button" data-id="${c.id}" data-username="${c.username}"><span><strong>${c.username}</strong><br><small>${c.major || '-'} · ${c.class_name || '-'}</small></span><span>Masukkan password ›</span></button>`).join('') : '<small style="color:#64748b">Nama tidak ditemukan. Coba kata kunci lain.</small>';
    searchResults.querySelectorAll('[data-id]').forEach(button => button.onclick = () => { selectedClient = { id: button.dataset.id, username: button.dataset.username }; selectedUser.textContent = `Pemilih: ${selectedClient.username}`; passwordInput.value = ''; loginMessage.textContent = ''; show(passwordStep); passwordInput.focus(); });
  }
  async function showCandidates() {
    const status = await (await fetch('/api/public/election-status')).json();
    if (!status.success || status.data.status !== 'open') { voteMessage.textContent = 'Pemilihan online belum dibuka atau sedang dijeda.'; return; }
    const result = await (await fetch('/api/candidates')).json();
    list.innerHTML = result.data.map(c => `<article class="candidate-card"><img src="${c.photo_path}" alt="Paslon ${c.ballot_number}"><div class="card-body"><h3>Paslon ${c.ballot_number}</h3><p><strong>${c.chair_name}</strong> & ${c.vice_name}</p><button class="btn-select-candidate" data-id="${c.id}">Pilih Paslon Ini</button></div></article>`).join('');
    list.querySelectorAll('[data-id]').forEach(button => button.onclick = async () => { if (!confirm('Pastikan pilihan Anda benar. Lanjutkan?')) return; button.disabled = true; const result = await api('/vote', { method:'POST', body:JSON.stringify({ candidate_id:Number(button.dataset.id) }) }); voteMessage.textContent = result.message; if (result.success) { token = null; sessionStorage.removeItem(tokenKey); list.innerHTML = ''; } button.disabled = false; });
  }
  let searchTimer;
  searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(searchClients, 250); });
  searchClients();
  document.getElementById('backToSearch').onclick = () => show(searchStep);
  document.getElementById('loginButton').onclick = async () => { if (!selectedClient || !passwordInput.value) { loginMessage.textContent = 'Pilih pemilih dan masukkan password.'; return; } const button = document.getElementById('loginButton'); button.disabled = true; loginMessage.textContent = ''; try { const result = await api('/login', { method:'POST', body:JSON.stringify({ identifier:selectedClient.id, password:passwordInput.value }) }); if (!result.success) loginMessage.textContent = result.message || 'Password salah.'; else { token = result.token; sessionStorage.setItem(tokenKey, token); show(voteStep); await showCandidates(); } } catch (error) { loginMessage.textContent = 'Backend online tidak terhubung.'; } button.disabled = false; };
})();
