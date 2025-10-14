// Divine Store (Remote Supabase)
// Uses RemoteStore for profiles; per-user by session.username

(function(){
  const $ = (s,r=document)=>r.querySelector(s);

  const RANKS = [
    {min:-999, name:'Forsaken'},
    {min:-4,   name:'Distant'},
    {min:1,    name:'Favored'},
    {min:5,    name:'Blessed'},
    {min:10,   name:'Chosen'},
    {min:15,   name:'Exemplar'}
  ];
  const rankFromFP = (fp)=> [...RANKS].reverse().find(r=>fp>=r.min).name;

  function defaultProfile(username){
    return { id: Math.random().toString(36).slice(2,10), name: username, god:'Tyr/Bahamut', level:1, fp:10, owned:[], lock:false };
  }

  function catalogForGod(god){
    const pack = (window.PACKS.GOD_PACKS[god]||[]).map(x=>({...x, pack:true}));
    return [...window.PACKS.BASE_ITEMS, ...pack];
  }

  async function mount(){
    const sess = Core.getSession(); if(!sess) return;
    let profile = await RemoteStore.loadProfile(sess.username);
    if(!profile){ profile = defaultProfile(sess.username); await RemoteStore.saveProfile(sess.username, profile); }

    const root = document.getElementById('viewRoot');
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
        <div class="field"><label>${I18N.t('patron')||'God / Patron'}</label>
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

    const fpEl = $('#fp', wrap);
    const rankEl = $('#rank', wrap);
    const godSel = $('#godSel', wrap);
    const q = $('#q', wrap);
    godSel.value = profile.god;

    function filteredItems(){
      const list = catalogForGod(profile.god);
      const term = (q.value||'').toLowerCase();
      if(!term) return list;
      return list.filter(it=> it.name.toLowerCase().includes(term) || it.desc.toLowerCase().includes(term));
    }

    async function renderItems(){
      const holder = $('#items', wrap); holder.innerHTML='';
      const list = filteredItems();
      for(const it of list){
        const owned = (profile.owned||[]).some(o=>o.id===it.id);
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
              ${(sess.role==='admin' && owned) ? '<button class="btn" data-act="refund">Refund (50%)</button>':''}
            </div>
          </div>
        `;
        card.querySelector('[data-act="buy"]')?.addEventListener('click', async ()=>{
          if(profile.lock || profile.fp<it.cost) return;
          if((profile.owned||[]).some(o=>o.id===it.id)) return;
          profile.fp -= it.cost; (profile.owned||=[]).push(it);
          await RemoteStore.saveProfile(sess.username, profile);
          fpEl.textContent = profile.fp; rankEl.textContent = rankFromFP(profile.fp);
          await renderItems(); await renderOwned();
        });
        card.querySelector('[data-act="refund"]')?.addEventListener('click', async ()=>{
          if(sess.role!=='admin') return;
          const ix = (profile.owned||[]).findIndex(o=>o.id===it.id); if(ix<0) return;
          profile.owned.splice(ix,1);
          profile.fp += Math.floor(it.cost*0.5);
          await RemoteStore.saveProfile(sess.username, profile);
          fpEl.textContent = profile.fp; rankEl.textContent = rankFromFP(profile.fp);
          await renderItems(); await renderOwned();
        });
        holder.appendChild(card);
      }
    }

    async function renderOwned(){
      const holder = $('#owned', wrap); holder.innerHTML='';
      if(!profile.owned?.length){ holder.innerHTML = '<div style="opacity:.7">—</div>'; return; }
      profile.owned.forEach(it=>{
        const row = document.createElement('div'); row.className='panel'; row.style.marginBottom='6px';
        row.innerHTML = `<div class="row" style="justify-content:space-between"><div>${it.name}</div><div style="opacity:.8">${it.type}</div></div>`;
        holder.appendChild(row);
      });
    }

    // Events
    godSel.addEventListener('change', async ()=>{
      profile.god = godSel.value; await RemoteStore.saveProfile(sess.username, profile); await renderItems();
    });
    q.addEventListener('input', renderItems);
    $('#fpPlus', wrap)?.addEventListener('click', async ()=>{ profile.fp++; await RemoteStore.saveProfile(sess.username, profile); fpEl.textContent=profile.fp; rankEl.textContent=rankFromFP(profile.fp); });
    $('#fpMinus', wrap)?.addEventListener('click', async ()=>{ profile.fp--; await RemoteStore.saveProfile(sess.username, profile); fpEl.textContent=profile.fp; rankEl.textContent=rankFromFP(profile.fp); });

    await renderItems(); await renderOwned();
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('goStore')?.addEventListener('click', ()=>{ mount(); });
    if(Core.getSession()) mount(); // auto-mount post-login
  });

  window.Store = { mount };
})();
