// Character Sheet (Remote Supabase)

(function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const t = (k,d)=> (window.I18N?.t?.(k,d)) || k;

  function defaultSheet(){
    return {
      prof:'+2', ac:'', hp:'', speed:'30 ft',
      str:'', dex:'', con:'', int:'', wis:'', cha:'',
      skills:'', inv:'', spells:'', notes:''
    };
  }

  async function mount(){
    const sess = Core.getSession(); if(!sess) return;
    let profile = await RemoteStore.loadProfile(sess.username);
    if(!profile){
      profile = { id:Math.random().toString(36).slice(2,10), name:sess.username, god:'Tyr/Bahamut', level:1, fp:10, owned:[], lock:false, sheet: defaultSheet() };
      await RemoteStore.saveProfile(sess.username, profile);
    }
    if(!profile.sheet){ profile.sheet = defaultSheet(); await RemoteStore.saveProfile(sess.username, profile); }

    const root = document.getElementById('viewRoot'); root.innerHTML='';

    const el = document.createElement('div');
    el.innerHTML = `
      <section class="panel">
        <h2>${t('sheet_title')||'Character Sheet'}</h2>
        <div class="row" style="flex-wrap:wrap;gap:12px">
          <div class="field" style="width:220px"><label>${t('name')||'Name'}</label><input id="cs_name"/></div>
          <div class="field" style="width:160px"><label>${t('class')||'Class'}</label><input id="cs_class"/></div>
          <div class="field" style="width:100px"><label>${t('level')||'Level'}</label><input id="cs_level" type="number" min="1" max="20"/></div>
          <div class="field" style="width:200px"><label>${t('patron')||'God / Patron'}</label><input id="cs_god"/></div>
          <div class="field" style="width:160px"><label>${t('alignment')||'Alignment'}</label><input id="cs_align"/></div>
          <div class="field" style="width:160px"><label>${t('proficiency')||'Proficiency'}</label><input id="cs_prof" placeholder="+2"/></div>
        </div>
        <div class="row" style="flex-wrap:wrap;gap:12px;margin-top:8px">
          <div class="field" style="width:90px"><label>STR</label><input id="cs_str" type="number"/></div>
          <div class="field" style="width:90px"><label>DEX</label><input id="cs_dex" type="number"/></div>
          <div class="field" style="width:90px"><label>CON</label><input id="cs_con" type="number"/></div>
          <div class="field" style="width:90px"><label>INT</label><input id="cs_int" type="number"/></div>
          <div class="field" style="width:90px"><label>WIS</label><input id="cs_wis" type="number"/></div>
          <div class="field" style="width:90px"><label>CHA</label><input id="cs_cha" type="number"/></div>
          <div class="field" style="width:120px"><label>${t('ac')||'AC'}</label><input id="cs_ac"/></div>
          <div class="field" style="width:120px"><label>${t('hp')||'HP'}</label><input id="cs_hp" placeholder="10/10"/></div>
          <div class="field" style="width:120px"><label>${t('speed')||'Speed'}</label><input id="cs_speed" placeholder="30 ft"/></div>
        </div>
        <div class="row" style="flex-wrap:wrap;gap:12px;margin-top:8px">
          <div class="field" style="flex:1"><label>${t('skills')||'Skills'}</label><textarea id="cs_skills" placeholder="Perception +4, Stealth +2…"></textarea></div>
          <div class="field" style="flex:1"><label>${t('inventory')||'Inventory'}</label><textarea id="cs_inv" placeholder="Weapons, armor, tools…"></textarea></div>
        </div>
        <div class="row" style="flex-wrap:wrap;gap:12px;margin-top:8px">
          <div class="field" style="flex:1"><label>${t('spells')||'Spells/Features'}</label><textarea id="cs_spells" placeholder="Prepared spells, class features…"></textarea></div>
          <div class="field" style="flex:1"><label>${t('notes')||'Notes'}</label><textarea id="cs_notes" placeholder="Divine vows, Faith notes, boons…"></textarea></div>
        </div>
        <div class="row" style="justify-content:flex-end;margin-top:10px">
          <button class="btn" id="sheetBack">${t('back')||'Back'}</button>
          <button class="btn" id="sheetSave">${t('save')||'Save'}</button>
        </div>
      </section>
    `;
    root.appendChild(el);

    // Populate
    const S = profile.sheet || {};
    const map = (id,val)=>{ const e=$('#'+id, el); if(e) e.value=val??''; };
    map('cs_name', profile.name);
    map('cs_class', profile.clazz);
    map('cs_level', profile.level);
    map('cs_god', profile.god);
    map('cs_align', profile.align);
    map('cs_prof', S.prof);
    map('cs_str', S.str); map('cs_dex', S.dex); map('cs_con', S.con);
    map('cs_int', S.int); map('cs_wis', S.wis); map('cs_cha', S.cha);
    map('cs_ac', S.ac); map('cs_hp', S.hp); map('cs_speed', S.speed);
    $('#cs_skills', el).value = S.skills||'';
    $('#cs_inv', el).value = S.inv||'';
    $('#cs_spells', el).value = S.spells||'';
    $('#cs_notes', el).value = S.notes||'';

    $('#sheetBack', el).addEventListener('click', ()=>{ root.innerHTML=''; });
    $('#sheetSave', el).addEventListener('click', async ()=>{
      profile.name  = $('#cs_name', el).value;
      profile.clazz = $('#cs_class', el).value;
      profile.level = parseInt($('#cs_level', el).value||profile.level,10);
      profile.god   = $('#cs_god', el).value;
      profile.align = $('#cs_align', el).value;
      profile.sheet = {
        prof: $('#cs_prof', el).value,
        str:$('#cs_str', el).value, dex:$('#cs_dex', el).value, con:$('#cs_con', el).value,
        int:$('#cs_int', el).value, wis:$('#cs_wis', el).value, cha:$('#cs_cha', el).value,
        ac:$('#cs_ac', el).value, hp:$('#cs_hp', el).value, speed:$('#cs_speed', el).value,
        skills: $('#cs_skills', el).value, inv:$('#cs_inv', el).value, spells:$('#cs_spells', el).value, notes:$('#cs_notes', el).value
      };
      await RemoteStore.saveProfile(sess.username, profile);
      $('#sheetSave', el).textContent = t('saved')||'Saved';
      setTimeout(()=> $('#sheetSave', el).textContent = t('save')||'Save', 1200);
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('goSheet')?.addEventListener('click', ()=>{ mount(); });
  });

  window.Sheet = { mount };
})();
