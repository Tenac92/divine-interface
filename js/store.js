// Divine Store (Remote Supabase, Enhanced)
// - Uses RemoteStore for profiles (shared via Supabase)
// - Filters (type), sort (name/cost), debounced search
// - Loading/lock states, admin FP controls
// - Safe guards for missing globals

(function () {
  const $ = (s, r = document) => r.querySelector(s);

  // ===== Guards =====
  function assertEnv() {
    if (!window.Core || typeof Core.getSession !== 'function') {
      console.error('Core missing');
      return false;
    }
    if (!window.RemoteStore) {
      console.error('RemoteStore missing (storage.supabase.js not loaded)');
      return false;
    }
    if (!window.PACKS) {
      console.error('PACKS missing (data/packs.js not loaded)');
      return false;
    }
    return true;
  }

  // ===== Helpers =====
  const RANKS = [
    { min: -999, name: 'Forsaken' },
    { min: -4, name: 'Distant' },
    { min: 1, name: 'Favored' },
    { min: 5, name: 'Blessed' },
    { min: 10, name: 'Chosen' },
    { min: 15, name: 'Exemplar' },
  ];
  const rankFromFP = (fp) => [...RANKS].reverse().find((r) => fp >= r.min).name;

  const debounce = (fn, ms = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  function defaultProfile(username) {
    return {
      id: Math.random().toString(36).slice(2, 10),
      name: username,
      god: 'Tyr/Bahamut',
      level: 1,
      fp: 10,
      owned: [],
      lock: false,
    };
  }

  function catalogForGod(god) {
    const base = (window.PACKS?.BASE_ITEMS || []).map((x) => ({ ...x, pack: false }));
    const pack = (window.PACKS?.GOD_PACKS?.[god] || []).map((x) => ({ ...x, pack: true }));
    return [...base, ...pack];
  }

  function itemMatches(it, term) {
    if (!term) return true;
    const t = term.toLowerCase();
    return it.name.toLowerCase().includes(t) || (it.desc || '').toLowerCase().includes(t);
  }

  function sortItems(items, sortMode) {
    const arr = [...items];
    if (sortMode === 'cost') arr.sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || a.name.localeCompare(b.name));
    else arr.sort((a, b) => a.name.localeCompare(b.name)); // name
    return arr;
  }

  function filterByType(items, type) {
    if (!type || type === 'All') return items;
    return items.filter((x) => (x.type || '').toLowerCase() === type.toLowerCase());
  }

  // ===== View =====
  async function mount() {
    if (!assertEnv()) return;
    const sess = Core.getSession();
    if (!sess) return;

    const root = document.getElementById('viewRoot');
    if (!root) return;

    // Skeleton
    root.innerHTML = `
      <div class="panel" id="storePanel">
        <div id="storeHeader" class="row" style="justify-content:space-between;align-items:center">
          <h3 id="storeTitle">—</h3>
          <div class="row">
            <span class="btn">Rank: <b id="rank">—</b></span>
            <span class="btn">FP: <b id="fp">—</b></span>
            ${
              sess.role === 'admin'
                ? '<button class="btn" id="fpPlus">+1</button><button class="btn" id="fpMinus">−1</button><div class="field" style="margin:0;width:100px"><label style="opacity:.7">Set FP</label><input id="fpSet" type="number" /></div><button class="btn" id="fpSetBtn">OK</button>'
                : ''
            }
          </div>
        </div>

        <div id="storeControls" class="row" style="flex-wrap:wrap;gap:12px;margin:8px 0">
          <div class="field">
            <label>${I18N.t('patron') || 'God / Patron'}</label>
            <select id="godSel">
              <option>Tyr/Bahamut</option>
              <option>Raven Queen</option>
              <option>Silvanus</option>
              <option>Corellon</option>
            </select>
          </div>

          <div class="field" style="width:200px">
            <label>Type</label>
            <select id="typeSel">
              <option>All</option>
              <option>Blessing</option>
              <option>Equipment</option>
            </select>
          </div>

          <div class="field" style="width:200px">
            <label>Sort</label>
            <select id="sortSel">
              <option value="name">Name</option>
              <option value="cost">Cost</option>
            </select>
          </div>

          <div class="field" style="flex:1;min-width:200px">
            <label>${I18N.t('search') || 'Search'}</label>
            <input id="q" placeholder="name or text">
          </div>
        </div>

        <div id="lockBanner" class="panel hidden" style="background:rgba(239,68,68,.07);border-color:rgba(239,68,68,.35)">
          <div class="row" style="justify-content:space-between">
            <div style="color:#ef4444;font-weight:600">STORE LOCKED</div>
            <div style="opacity:.85">Purchases are disabled. (Ask your DM)</div>
          </div>
        </div>

        <div id="items" style="margin-top:10px"></div>
        <h4 style="margin:12px 0 6px">Owned</h4>
        <div id="owned"></div>
      </div>
    `;

    const titleEl = $('#storeTitle', root);
    const rankEl = $('#rank', root);
    const fpEl = $('#fp', root);
    const godSel = $('#godSel', root);
    const typeSel = $('#typeSel', root);
    const sortSel = $('#sortSel', root);
    const q = $('#q', root);
    const itemsEl = $('#items', root);
    const ownedEl = $('#owned', root);
    const lockBanner = $('#lockBanner', root);

    // Loading indicator
    itemsEl.innerHTML = `<div class="notice">Loading store…</div>`;

    // Load or init profile
    let profile = await RemoteStore.loadProfile(sess.username);
    if (!profile) {
      profile = defaultProfile(sess.username);
      await RemoteStore.saveProfile(sess.username, profile);
    }

    // Header
    function updateHeader() {
      titleEl.textContent = `${profile.name} — ${profile.god}`;
      rankEl.textContent = rankFromFP(profile.fp ?? 0);
      fpEl.textContent = profile.fp ?? 0;
      lockBanner.classList.toggle('hidden', !profile.lock);
    }
    updateHeader();
    godSel.value = profile.god;

    // Catalog + UI transforms
    function computeList() {
      const term = (q.value || '').trim();
      const type = typeSel.value;
      const sort = sortSel.value;
      const all = catalogForGod(profile.god);
      const filtered = filterByType(all.filter((it) => itemMatches(it, term)), type);
      const sorted = sortItems(filtered, sort);
      return sorted;
    }

    async function renderOwned() {
      ownedEl.innerHTML = '';
      if (!profile.owned?.length) {
        ownedEl.innerHTML = '<div class="notice">—</div>';
        return;
      }
      profile.owned.forEach((it) => {
        const row = document.createElement('div');
        row.className = 'panel';
        row.style.marginBottom = '6px';
        row.innerHTML = `
          <div class="row" style="justify-content:space-between">
            <div>
              <div style="font-weight:700">${it.name}</div>
              <div style="opacity:.8;font-size:12px">${it.type || '—'} • ${it.cost ?? 0} FP</div>
            </div>
            <div style="opacity:.7">${it.pack ? 'God Pack' : 'Base'}</div>
          </div>
        `;
        ownedEl.appendChild(row);
      });
    }

    function itemCard(it, owned) {
      const disableBuy = owned || (profile.fp ?? 0) < (it.cost ?? 0) || profile.lock;
      const whyDisabled = profile.lock
        ? 'Locked'
        : owned
        ? 'Owned'
        : (profile.fp ?? 0) < (it.cost ?? 0)
        ? 'Not enough FP'
        : '';
      const tip = whyDisabled ? `title="${whyDisabled}"` : '';
      const cost = it.cost ?? 0;

      const div = document.createElement('div');
      div.className = 'panel';
      div.style.marginBottom = '8px';
      div.innerHTML = `
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-weight:700">${it.name}</div>
            <div style="opacity:.85;font-size:13px;margin-top:2px">${it.desc || ''}</div>
            <div style="opacity:.7;font-size:12px;margin-top:4px">${it.type || '—'} • ${it.pack ? 'God Pack' : 'Base'}</div>
          </div>
          <div class="row">
            <div class="btn">Cost: ${cost} FP</div>
            <button class="btn" ${tip} ${disableBuy ? 'disabled' : ''} data-act="buy">${owned ? 'Owned' : 'Purchase'}</button>
            ${
              Core.getSession().role === 'admin' && owned
                ? '<button class="btn" data-act="refund">Refund (50%)</button>'
                : ''
            }
          </div>
        </div>
      `;
      return div;
    }

    async function renderItems() {
      itemsEl.innerHTML = '';
      const list = computeList();

      if (!list.length) {
        itemsEl.innerHTML = '<div class="notice">No items match your filters.</div>';
        return;
      }

      list.forEach((it) => {
        const owned = (profile.owned || []).some((o) => o.id === it.id);
        const card = itemCard(it, owned);

        card.querySelector('[data-act="buy"]')?.addEventListener('click', async () => {
          // Re-check latest from server to prevent double-spend edge cases
          const fresh = await RemoteStore.loadProfile(sess.username);
          if (!fresh) return; // cannot proceed
          profile = fresh;

          if (profile.lock) return;
          if ((profile.owned || []).some((o) => o.id === it.id)) return;
          if ((profile.fp ?? 0) < (it.cost ?? 0)) return;

          profile.fp -= it.cost ?? 0;
          (profile.owned || (profile.owned = [])).push(it);
          await RemoteStore.saveProfile(sess.username, profile);

          updateHeader();
          await renderItems();
          await renderOwned();
        });

        card.querySelector('[data-act="refund"]')?.addEventListener('click', async () => {
          if (Core.getSession().role !== 'admin') return;

          // Get fresh
          const fresh = await RemoteStore.loadProfile(sess.username);
          if (!fresh) return;
          profile = fresh;

          const ix = (profile.owned || []).findIndex((o) => o.id === it.id);
          if (ix < 0) return;

          profile.owned.splice(ix, 1);
          profile.fp = (profile.fp ?? 0) + Math.floor((it.cost ?? 0) * 0.5);
          await RemoteStore.saveProfile(sess.username, profile);

          updateHeader();
          await renderItems();
          await renderOwned();
        });

        itemsEl.appendChild(card);
      });
    }

    // ===== Events =====
    const rerender = debounce(async () => {
      await renderItems();
      await renderOwned();
    }, 200);

    godSel.addEventListener('change', async () => {
      profile.god = godSel.value;
      await RemoteStore.saveProfile(sess.username, profile);
      updateHeader();
      await renderItems();
    });

    typeSel.addEventListener('change', rerender);
    sortSel.addEventListener('change', rerender);
    q.addEventListener('input', rerender);

    $('#fpPlus', root)?.addEventListener('click', async () => {
      profile.fp = (profile.fp ?? 0) + 1;
      await RemoteStore.saveProfile(sess.username, profile);
      updateHeader();
      await renderItems();
    });
    $('#fpMinus', root)?.addEventListener('click', async () => {
      profile.fp = (profile.fp ?? 0) - 1;
      await RemoteStore.saveProfile(sess.username, profile);
      updateHeader();
      await renderItems();
    });
    $('#fpSetBtn', root)?.addEventListener('click', async () => {
      const val = parseInt($('#fpSet', root).value || `${profile.fp ?? 0}`, 10);
      if (Number.isFinite(val)) {
        profile.fp = val;
        await RemoteStore.saveProfile(sess.username, profile);
        updateHeader();
        await renderItems();
      }
    });

    // Initial render
    await renderItems();
    await renderOwned();
  }

  // Wire navigation
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('goStore')?.addEventListener('click', () => {
      mount();
    });
    // Auto-mount if already logged in
    if (window.Core?.getSession?.()) mount();
  });

  // expose minimal API if needed later
  window.Store = { mount };
})();
