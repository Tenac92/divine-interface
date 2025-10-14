// Core & Auth (Remote Supabase)
// - First-run Admin Setup (no default admin)
// - Sessions in localStorage, data in Supabase
// - Theme & Language toggles
// - Async rendering with RemoteStore

(function(){
  const SESSION_KEY = 'divine_session_v1';
  const THEME_KEY   = 'divine_theme';
  const LANG_KEY    = 'divine_lang';

  let session = null; // {userId, username, role}

  const $ = (sel, root=document)=> root.querySelector(sel);
  const rid = ()=> Math.random().toString(36).slice(2,10);

  // session-only (local)
  function getSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); }catch{ return null; } }
  function setSession(s){ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  // theme/lang (local)
  function getTheme(){ return localStorage.getItem(THEME_KEY)||'dark'; }
  function setTheme(v){ localStorage.setItem(THEME_KEY,v); document.documentElement.setAttribute('data-theme', v==='light'?'light':'dark'); }
  function getLang(){ return localStorage.getItem(LANG_KEY)||'en'; }
  function setLang(v){
    localStorage.setItem(LANG_KEY,v);
    if ($('#langBtn')) $('#langBtn').textContent = v.toUpperCase();
    I18N.setLang(v);
    syncStaticText();
    if ($('#authRoot') && !$('#appRoot')?.classList.contains('hidden')) return;
    renderAuth(); // refresh auth labels if visible
  }

  function safeText(el, key){ if (el){ const val = I18N.t(key); if (typeof val==='string') el.textContent = val; } }
  function syncStaticText(){
    safeText($('#title'), 'app_title');
    safeText($('#logoutBtn'), 'logout');
    safeText($('#appHint'), 'app_hint');
    safeText($('#goStore'), 'nav_store');
    safeText($('#goSheet'), 'nav_sheet');
    safeText($('#goAdmin'), 'nav_admin');
  }

  // ===== AUTH RENDERING (async) =====
  async function renderAuth(){
    const root = $('#authRoot'); if(!root) return;
    root.innerHTML = '';

    const users = await RemoteStore.loadUsers();

    if(!users || users.length===0){
      // First-run Admin Setup
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <h2>${I18N.t('admin_setup')}</h2>
        <p style="opacity:.85">${I18N.t('admin_setup_tip')}</p>
        <div class="field"><label>${I18N.t('admin_username')}</label><input id="S_user" placeholder="dm-admin"></div>
        <div class="field"><label>${I18N.t('admin_password')}</label><input id="S_pass" type="password" placeholder="••••••"></div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn" id="setupBtn">${I18N.t('create_admin')}</button>
        </div>
      `;
      root.appendChild(wrap);
      $('#setupBtn',wrap).addEventListener('click', async ()=>{
        const u = $('#S_user',wrap).value.trim();
        const p = $('#S_pass',wrap).value.trim();
        if(!u||!p){ alert(I18N.t('need_credentials')); return; }
        const next = [{ id: rid(), username:u, password:p, role:'admin' }];
        await RemoteStore.saveUsers(next);
        await renderAuth();
      });
      return;
    }

    // Login form
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <h2>${I18N.t('login')}</h2>
      <div class="field"><label>${I18N.t('username')}</label><input id="L_user" placeholder="galahad"></div>
      <div class="field"><label>${I18N.t('password')}</label><input id="L_pass" type="password" placeholder="••••••"></div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn" id="loginBtn">${I18N.t('login')}</button>
      </div>
      <div id="loginMsg" style="margin-top:6px;color:var(--muted);font-size:13px"></div>
    `;
    root.appendChild(wrap);

    $('#loginBtn',wrap).addEventListener('click', async ()=>{
      const u = $('#L_user',wrap).value.trim();
      const p = $('#L_pass',wrap).value.trim();
      const users2 = await RemoteStore.loadUsers();
      const found = users2.find(x=>x.username===u && x.password===p);
      if(!found){ $('#loginMsg',wrap).textContent = I18N.t('invalid'); return; }
      session = { userId: found.id, username: found.username, role: found.role };
      setSession(session);
      await renderApp();
    });
  }

  // ===== APP SHELL =====
  async function renderApp(){
    $('#authRoot')?.classList.add('hidden');
    const app = $('#appRoot'); app.classList.remove('hidden');

    $('#userBadge').textContent = `${session.username} • ${session.role}`;
    $('#logoutBtn').classList.remove('hidden');

    const w = I18N.t('welcome', {name: session.username});
    if (typeof w === 'string') $('#welcome').textContent = w;

    // Show Admin nav if admin
    if(session.role==='admin') $('#goAdmin')?.classList.remove('hidden');

    syncStaticText();
  }

  function logout(){
    clearSession();
    session = null;
    $('#logoutBtn').classList.add('hidden');
    $('#appRoot').classList.add('hidden');
    $('#authRoot').classList.remove('hidden');
    renderAuth();
  }

  // ===== INIT =====
  setTheme(getTheme());
  setLang(getLang());
  syncStaticText();

  $('#themeBtn')?.addEventListener('click', ()=> setTheme(getTheme()==='dark'?'light':'dark'));
  $('#langBtn')?.addEventListener('click', ()=> setLang(getLang()==='en'?'el':'en'));
  $('#logoutBtn')?.addEventListener('click', logout);

  const sess = getSession();
  if(sess){ session = sess; renderApp(); } else { renderAuth(); }

  window.Core = {
    getLang, setLang, getTheme, setTheme,
    getSession: ()=>session,
    logout,
    // (Remote users are only through RemoteStore)
  };
})();
