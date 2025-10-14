// Divine Store (Phase 2)
// Minimal, modular store view wired to Core + PACKS

(function(){
  const PROFILES_KEY = 'divine_profiles_v1';

  // ===== Utilities
  const $ = (sel,root=document)=>root.querySelector(sel);
  const rid = ()=> Math.random().toString(36).slice(2,10);

  function loadProfiles(){ try{ const raw = localStorage.getItem(PROFILES_KEY); return raw? JSON.parse(raw): {}; }catch(e){ return {}; } }
  function saveProfiles(v){ localStorage.setItem(PROFILES_KEY, JSON.stringify(v)); }

  function ensureProfile(username){
    const profiles = loadProfiles();
    if(!profiles[username]){
      profiles[username] = { id: rid(), name: username, god:'Tyr/Bahamut', level:1, fp:10, owned:[], lock:false };
      saveProfiles(profiles);
    }
    return profiles[username];
  }

  function saveProfile(username, data){ const all = loadProfiles(); all[username] = data; saveProfiles(all); }

  // ===== Ranks
  const RANKS = [
    {min:-999, name:'Forsaken'},
    {min:-4,   name:'Distant'},
    {min:1,    name:'Favored'},
    {min:5,    name:'Blessed'},
    {min:10,   name:'Chosen'},
    {min:15,   name:'Exemplar'}
  ];
  const rankFromFP = (fp)=> [...RANKS].reverse().find(r=>fp>=r.min).name;

  // ===== Rendering
  function mount(){
    const sess = Core.getSession(); if(!sess) return;
    const profile = ensureProfile(sess.username);

    const root = $('#viewRoot');
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center">
        <h3>${profile.name} — ${profile.god}</h3>
        <div class="row">
          <span class="btn">Rank: <b id="rank">${rankFromFP(profile.fp)}</b></span>
          <span class="btn">FP: <b id="fp">${profile.fp}</b></span>
          ${sess.role==='admin'? '<button class="btn" id="fpPlus">+1</button><button class="btn" id="fpMinus">−1</button>':''}
        </div>
      </div>

      <div class="row" style="margin:8px 0">
        <div class="field"><label>${I18N.t('patron')||'Patron'}</label>
          <select id="godSel">
            <option>Tyr/Bahamut</option>
            <option>Raven Queen</option>
            <option>Silvanus</option>
            <option>Corellon</option>
          </select>
        </div>
        <div class="field" style="flex:1"><label>Search</label><input id="q" placeholder="name or text"></div>
      </div>

      <div id="items"></div>
      <h4 style="margin:12px 0 6px">Owned</h4>
      <div id="owned"></div>
    `;
    root.appendChild(wrap);

    // bind selectors
    const fpEl = $('#fp', wrap);
    const rankEl = $('#rank', wrap);
    const godSel = $('#godSel', wrap);
    const q = $('#q', wrap);

    godSel.value = profile.god;

    function catalog(){
      const pack = (window.PACKS.GOD_PACKS[profile.god]||[]).map(x=>({...x, pack:true}));
      return [...window.PACKS.BASE_ITEMS, ...pack];
    }

    function renderItems(){
      const list = catalog().filter(it=> !q.value || it.name.toLowerCase().includes(q.value.toLowerCase()) || it.desc.toLowerCase().includes(q.value.toLowerCase()));
      const holder = $('#items', wrap); holder.innerHTML='';
      list.forEach(it=>{
        const owned = profile.owned.some(o=>o.id===it.id);
        const card = document.createElement('div'); card.className='panel'; card.style.marginBottom='8px';
        card.innerHTML = `
          <div class="row" style="justify-content:space-between">
            <div>
              <div style="font-weight:700">${it.name}</div>
              <div style="opacity:.85;font-size:13px">${it.desc}</div>
            </div>
            <div class="row">
              <div class="btn">Cost: ${it.cost} FP</div>
              <button class="btn" ${owned||profile.fp<it.cost||profile.lock?'disabled':''} data-act="buy">${owned? 'Owned' : 'Purchase'}</button>
              ${ (Core.getSession().role==='admin' && owned) ? '<button class="btn" data-act="refund">Refund (50%)</button>':''}
            </div>
          </div>
        `;
        card.querySelector('[data-act="buy"]')?.addEventListener('click', ()=>{
          if(profile.lock) return;
          if(profile.fp<it.cost) return;
          if(profile.owned.some(o=>o.id===it.id)) return;
          profile.fp -= it.cost; profile.owned.push(it);
          saveProfile(sess.username, profile);
          fpEl.textContent = profile.fp; rankEl.textContent = rankFromFP(profile.fp);
          renderItems(); renderOwned();
        });
        card.querySelector('[data-act="refund"]')?.addEventListener('click', ()=>{
          if(Core.getSession().role!=='admin') return;
          const ix = profile.owned.findIndex(o=>o.id===it.id); if(ix<0) return;
          profile.owned.splice(ix,1);
          profile.fp += Math.floor(it.cost*0.5);
          saveProfile(sess.username, profile);
          fpEl.textContent = profile.fp; rankEl.textContent = rankFromFP(profile.fp);
          renderItems(); renderOwned();
        });
        holder.appendChild(card);
      });
    }

    function renderOwned(){
      const holder = $('#owned', wrap); holder.innerHTML='';
      if(!profile.owned.length){ holder.innerHTML = '<div style="opacity:.7">—</div>'; return; }
      profile.owned.forEach(it=>{
        const row = document.createElement('div'); row.className='panel'; row.style.marginBottom='6px';
        row.innerHTML = `<div class="row" style="justify-content:space-between"><div>${it.name}</div><div style="opacity:.8">${it.type}</div></div>`;
        holder.appendChild(row);
      });
    }

    // Events
    godSel.addEventListener('change', ()=>{ profile.god = godSel.value; saveProfile(sess.username, profile); renderItems(); });
    q.addEventListener('input', renderItems);
    $('#fpPlus', wrap)?.addEventListener('click', ()=>{ profile.fp++; saveProfile(sess.username, profile); fpEl.textContent=profile.fp; rankEl.textContent=rankFromFP(profile.fp); });
    $('#fpMinus', wrap)?.addEventListener('click', ()=>{ profile.fp--; saveProfile(sess.username, profile); fpEl.textContent=profile.fp; rankEl.textContent=rankFromFP(profile.fp); });

    renderItems(); renderOwned();
  }

  // Wire navigation
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('goStore');
    if(btn){ btn.addEventListener('click', mount); }
    // Auto-mount store after login
    const sess = Core.getSession(); if(sess){ mount(); }
  });

  // expose minimal API if needed later
  window.Store = { mount };
})();
