// Admin — Users & Profiles (Remote Supabase)

(function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const t = (k,o)=> (window.I18N?.t?.(k,o)) || k;
  const rid = ()=> Math.random().toString(36).slice(2,10);

  async function renderUsers(listEl){
    const users = await RemoteStore.loadUsers();
    listEl.innerHTML = '';
    if(!users.length){ listEl.innerHTML = '<div style="opacity:.7">—</div>'; return; }
    users.forEach(u=>{
      const row = document.createElement('div'); row.className='panel'; row.style.margin='6px 0';
      row.innerHTML = `
        <div class="row" style="justify-content:space-between;gap:12px">
          <div>${u.username} <span style="opacity:.7">• ${u.role}</span></div>
          <div class="row">
            <select data-act="role">
              <option value="player" ${u.role==='player'?'selected':''}>${t('player')}</option>
              <option value="admin" ${u.role==='admin'?'selected':''}>${t('admin')}</option>
            </select>
            <button class="btn" data-act="del">${t('delete_user')}</button>
          </div>
        </div>`;
      row.querySelector('[data-act="role"]').addEventListener('change', async (e)=>{
        u.role = e.target.value;
        const all = await RemoteStore.loadUsers();
        const ix = all.findIndex(x=>x.username===u.username);
        if(ix>=0) all[ix].role = u.role; else all.push(u);
        await RemoteStore.saveUsers(all);
        await renderUsers(listEl);
      });
      row.querySelector('[data-act="del"]').addEventListener('click', async ()=>{
        const all = await RemoteStore.loadUsers();
        const next = all.filter(x=>x.username!==u.username);
        await RemoteStore.saveUsers(next);
        await renderUsers(listEl);
      });
      listEl.appendChild(row);
    });
  }

  async function renderProfiles(listEl){
    const profiles = await RemoteStore.loadProfiles();
    listEl.innerHTML = '';
    const usernames = Object.keys(profiles||{});
    if(!usernames.length){ listEl.innerHTML = '<div style="opacity:.7">—</div>'; return; }

    usernames.forEach(user=>{
      const p = profiles[user];
      const row = document.createElement('div'); row.className='panel'; row.style.margin='6px 0';
      row.innerHTML = `
        <div class="row" style="justify-content:space-between;gap:12px;align-items:flex-start">
          <div>
            <div style="font-weight:700">${p.name||user} <span style="opacity:.65">(${user})</span></div>
            <div style="opacity:.85;font-size:13px">${p.clazz||'—'} • Lv ${p.level||1} • ${p.god||'—'} • ${p.align||'—'}</div>
            <div style="opacity:.85;font-size:12px">FP: <b>${p.fp??0}</b> • Owned: <b>${(p.owned||[]).length}</b> ${p.lock? ' • 🔒':''}</div>
          </div>
          <div class="row" style="gap:6px;flex-wrap:wrap">
            <button class="btn" data-act="fp-5">-5</button>
            <button class="btn" data-act="fp-1">-1</button>
            <button class="btn" data-act="fp+1">+1</button>
            <button class="btn" data-act="fp+5">+5</button>
            <div class="field" style="margin:0">
              <label>${t('set_fp')}</label>
              <input type="number" data-act="setFP" value="${p.fp??0}" style="width:100px">
            </div>
            <button class="btn" data-act="lock">${t('lock_toggle')}</button>
            <button class="btn" data-act="clear">${t('clear_owned')}</button>
            <button class="btn" data-act="del">${t('delete_user')}</button>
          </div>
        </div>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
          <div class="field"><label>${t('owner_lbl')}</label><input data-act="owner" value="${user}"></div>
          <div class="field"><label>${t('name')}</label><input data-act="name" value="${p.name||''}"></div>
          <div class="field"><label>${t('class')}</label><input data-act="clazz" value="${p.clazz||''}"></div>
          <div class="field"><label>${t('level')}</label><input type="number" min="1" max="20" data-act="level" value="${p.level||1}"></div>
          <div class="field"><label>${t('god_lbl')}</label><input data-act="god" value="${p.god||''}"></div>
          <div class="field"><label>${t('align_lbl')}</label><input data-act="align" value="${p.align||''}"></div>
        </div>
      `;

      // FP controls
      row.querySelector('[data-act="fp-5"]').addEventListener('click', async ()=>{ p.fp=(p.fp??0)-5; await RemoteStore.saveProfile(user, p); await renderProfiles(listEl); });
      row.querySelector('[data-act="fp-1"]').addEventListener('click', async ()=>{ p.fp=(p.fp??0)-1; await RemoteStore.saveProfile(user, p); await renderProfiles(listEl); });
      row.querySelector('[data-act="fp+1"]').addEventListener('click', async ()=>{ p.fp=(p.fp??0)+1; await RemoteStore.saveProfile(user, p); await renderProfiles(listEl); });
      row.querySelector('[data-act="fp+5"]').addEventListener('click', async ()=>{ p.fp=(p.fp??0)+5; await RemoteStore.saveProfile(user, p); await renderProfiles(listEl); });
      row.querySelector('[data-act="setFP"]').addEventListener('change', async (e)=>{ p.fp=parseInt(e.target.value||p.fp||0,10); await RemoteStore.saveProfile(user, p); });

      // Lock / Clear / Delete
      row.querySelector('[data-act="lock"]').addEventListener('click', async ()=>{ p.lock = !p.lock; await RemoteStore.saveProfile(user, p); await renderProfiles(listEl); });
      row.querySelector('[data-act="clear"]').addEventListener('click', async ()=>{ p.owned=[]; await RemoteStore.saveProfile(user, p); await renderProfiles(listEl); });
      row.querySelector('[data-act="del"]').addEventListener('click', async ()=>{ const map = await RemoteStore.loadProfiles(); delete map[user]; await RemoteStore.saveProfiles(map); await renderProfiles(listEl); });

      // Editable fields
      row.querySelectorAll('input[data-act]').forEach(inp=>{
        inp.addEventListener('change', async ()=>{
          const act = inp.getAttribute('data-act');
          const val = inp.value;
          if(act==='owner'){
            if(val && val!==user){
              // re-key: delete old, write new
              await RemoteStore.saveProfile(val, p);
              const map = await RemoteStore.loadProfiles();
              delete map[user];
              await RemoteStore.saveProfiles(map);
              await renderProfiles(listEl);
            }
          } else if (act==='level') {
            p[act] = parseInt(val||p.level||1,10);
            await RemoteStore.saveProfile(user, p);
          } else {
            p[act] = val;
            await RemoteStore.saveProfile(user, p);
          }
        });
      });

      listEl.appendChild(row);
    });
  }

  async function mount(){
    const sess = Core.getSession(); if(!sess || sess.role!=='admin') return;
    const root = document.getElementById('viewRoot'); if(!root) return; root.innerHTML='';

    document.getElementById('goAdmin')?.classList.remove('hidden');

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <section class="panel">
        <h2>${t('admin_title')}</h2>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          <button class="btn" id="btnExport">${t('export_data')}</button>
          <button class="btn" id="btnImport">${t('import_data')}</button>
        </div>
      </section>

      <section class="panel" id="usersSec" style="margin-top:10px">
        <h3>${t('users_title')}</h3>
        <div class="row" style="gap:12px;flex-wrap:wrap;margin-bottom:8px">
          <div class="field"><label>${t('username_lbl')}</label><input id="U_name" placeholder="player1"></div>
          <div class="field"><label>${t('password_lbl')}</label><input id="U_pass" type="password" placeholder="••••••"></div>
          <div class="field"><label>${t('role_lbl')}</label>
            <select id="U_role"><option value="player">${t('player')}</option><option value="admin">${t('admin')}</option></select>
          </div>
          <button class="btn" id="U_add">${t('add_user')}</button>
        </div>
        <div id="usersList"></div>
      </section>

      <section class="panel" id="profilesSec" style="margin-top:10px">
        <h3>${t('profiles_title')}</h3>
        <div class="row" style="gap:12px;flex-wrap:wrap;margin-bottom:8px">
          <div class="field"><label>${t('owner_lbl')}</label><input id="P_owner" placeholder="username"></div>
          <div class="field"><label>${t('name')}</label><input id="P_name" placeholder="Character name"></div>
          <div class="field"><label>${t('class')}</label><input id="P_class" placeholder="Class"></div>
          <div class="field"><label>${t('level')}</label><input id="P_level" type="number" min="1" max="20" value="1"></div>
          <div class="field"><label>${t('god_lbl')}</label><input id="P_god" placeholder="Tyr/Bahamut"></div>
          <div class="field"><label>${t('align_lbl')}</label><input id="P_align" placeholder="Lawful Good"></div>
          <div class="field"><label>${t('fp_lbl')}</label><input id="P_fp" type="number" value="10"></div>
          <button class="btn" id="P_add">${t('add_profile')}</button>
        </div>
        <div id="profilesList"></div>
      </section>
    `;
    root.appendChild(wrap);

    const usersListEl = document.getElementById('usersList');
    const profilesListEl = document.getElementById('profilesList');

    document.getElementById('U_add').addEventListener('click', async ()=>{
      const u = document.getElementById('U_name').value.trim();
      const p = document.getElementById('U_pass').value.trim();
      const r = document.getElementById('U_role').value;
      if(!u||!p) return alert(I18N.t('need_credentials'));
      const arr = await RemoteStore.loadUsers();
      if(!arr.find(x=>x.username===u)) arr.push({id:rid(), username:u, password:p, role:r});
      await RemoteStore.saveUsers(arr);
      await renderUsers(usersListEl);
    });

    document.getElementById('P_add').addEventListener('click', async ()=>{
      const owner = document.getElementById('P_owner').value.trim();
      const name  = document.getElementById('P_name').value.trim();
      if(!owner||!name) return alert('Owner & Name required');
      const prof = await RemoteStore.loadProfile(owner) || { id:rid(), owned:[], lock:false };
      Object.assign(prof, {
        name,
        clazz: document.getElementById('P_class').value.trim(),
        level: parseInt(document.getElementById('P_level').value||'1',10),
        god:   document.getElementById('P_god').value.trim(),
        align: document.getElementById('P_align').value.trim(),
        fp:    parseInt(document.getElementById('P_fp').value||'10',10)
      });
      await RemoteStore.saveProfile(owner, prof);
      await renderProfiles(profilesListEl);
    });

    // Export/Import combined
    document.getElementById('btnExport').addEventListener('click', async ()=>{
      const data = { users: await RemoteStore.loadUsers(), profiles: await RemoteStore.loadProfiles() };
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='divine-admin-export.json'; a.click(); URL.revokeObjectURL(url);
    });
    document.getElementById('btnImport').addEventListener('click', ()=>{
      const i = document.createElement('input'); i.type='file'; i.accept='.json';
      i.onchange=async ()=>{
        const f = i.files[0]; if(!f) return;
        const fr=new FileReader();
        fr.onload=async ()=>{
          try{
            const data=JSON.parse(fr.result);
            if(Array.isArray(data.users)) await RemoteStore.saveUsers(data.users);
            if(data.profiles && typeof data.profiles==='object') await RemoteStore.saveProfiles(data.profiles);
            await renderUsers(usersListEl); await renderProfiles(profilesListEl);
          }catch(e){ alert('Invalid JSON'); }
        };
        fr.readAsText(f);
      };
      i.click();
    });

    await renderUsers(usersListEl);
    await renderProfiles(profilesListEl);
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('goAdmin');
    if(btn){ btn.addEventListener('click', ()=>{ mount(); }); }
    const sess = Core.getSession();
    if(sess?.role==='admin' && btn){ btn.classList.remove('hidden'); }
  });

  window.Admin = { mount };
})();
