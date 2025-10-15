/*
  sheet.js — D&D 5e Character Sheet (Supabase version) — mapped to your catalog.supabase.js
  Field alignment:
    Weapons: { id, name, category, weapon_group, damage_dice, damage_type, properties, ... }
             -> UI shows "category • weapon_group" and "damage_dice damage_type"
    Spells:  { id, name, level, school, casting_time, ... } (directly used)
*/

(function () {
  "use strict";

  // ---------- Utilities ----------
  const LS_KEY = "character.sheet.v1";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const debounce = (fn, ms = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  function assertCatalog() {
    if (!window.CatalogAPI) {
      const msg =
        "[sheet.js] window.CatalogAPI not found. Include js/catalog.supabase.js before sheet.js";
      console.error(msg);
      throw new Error(msg);
    }
  }

  // ---------- State ----------
  const defaultState = () => ({
    meta: { name: "", level: 1, speciesId: null, classId: null },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    weapons: [], // [{id, name, category, weapon_group, damage_dice, damage_type, properties}]
    spells: [], // [{id, name, level, school, casting_time}]
    inventory: [], // [{name, qty}]
    notes: "",
    updatedAt: new Date().toISOString(),
  });

  let state = loadState();

  function saveState() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    markSaved();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      const obj = JSON.parse(raw);
      if (!obj.meta || !obj.abilities) return defaultState();
      return obj;
    } catch {
      return defaultState();
    }
  }

  function markSaved() {
    const el = $("#saveStatus");
    if (!el) return;
    el.textContent = "Saved ✓";
    el.style.opacity = "1";
    setTimeout(() => (el.style.opacity = "0.6"), 800);
  }

  function markDirty() {
    const el = $("#saveStatus");
    if (!el) return;
    el.textContent = "Unsaved…";
    el.style.opacity = "1";
  }

  const autosave = debounce(() => saveState(), 400);

  function bindAutoSaveInputs(container) {
    $$(".autosave", container).forEach((input) => {
      input.addEventListener("input", () => {
        markDirty();
        autosave();
      });
      input.addEventListener("change", () => {
        markDirty();
        autosave();
      });
    });
  }

  // ---------- Rendering ----------
  function initTabs() {
    const tabButtons = $$(".tab-btn");
    const tabPanels = $$(".tab-panel");
    function show(id) {
      tabButtons.forEach((b) =>
        b.classList.toggle("active", b.dataset.tab === id)
      );
      tabPanels.forEach(
        (p) => (p.style.display = p.id === id ? "block" : "none")
      );
      savePreferredTab(id);
    }
    tabButtons.forEach((btn) =>
      btn.addEventListener("click", () => show(btn.dataset.tab))
    );
    const start = loadPreferredTab() || tabButtons[0]?.dataset.tab;
    if (start) show(start);
  }

  const TAB_LS = "character.sheet.tab";
  const savePreferredTab = (id) => localStorage.setItem(TAB_LS, id);
  const loadPreferredTab = () => localStorage.getItem(TAB_LS);

  function abilityMod(score) {
    return Math.floor((Number(score) - 10) / 2);
  }

  function renderAbilities() {
    const root = $("#abilities");
    const fields = ["str", "dex", "con", "int", "wis", "cha"];
    root.innerHTML = fields
      .map((k) => {
        const val = state.abilities[k] ?? 10;
        const mod = abilityMod(val);
        return `
        <div class="ability">
          <label>${k.toUpperCase()}</label>
          <input class="autosave" type="number" min="1" max="30" data-ability="${k}" value="${val}" />
          <div class="mod">mod: ${mod >= 0 ? "+" : ""}${mod}</div>
        </div>`;
      })
      .join("");

    $$(".ability input", root).forEach((inp) => {
      inp.addEventListener("input", () => {
        const key = inp.dataset.ability;
        state.abilities[key] = Number(inp.value || 10);
        markDirty();
        autosave();
        renderAbilities();
      });
    });

    bindAutoSaveInputs(root);
  }

  function setSelectOptions(select, items, textKey = "name", valueKey = "id") {
    select.innerHTML =
      `<option value="">— Select —</option>` +
      items
        .map(
          (x) =>
            `<option value="${x[valueKey]}">${escapeHtml(x[textKey])}</option>`
        )
        .join("");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function populateMetaPickers() {
    assertCatalog();
    const [species, classes] = await Promise.all([
      window.CatalogAPI.listSpecies(),
      window.CatalogAPI.listClasses(),
    ]);

    const speciesSel = $("#speciesSelect");
    const classSel = $("#classSelect");
    setSelectOptions(speciesSel, species);
    setSelectOptions(classSel, classes);

    if (state.meta.speciesId) speciesSel.value = String(state.meta.speciesId);
    if (state.meta.classId) classSel.value = String(state.meta.classId);

    speciesSel.addEventListener("change", () => {
      state.meta.speciesId = speciesSel.value || null;
      markDirty();
      autosave();
    });
    classSel.addEventListener("change", () => {
      state.meta.classId = classSel.value || null;
      markDirty();
      autosave();
    });
  }

  // ---------- Quick Add (Weapons / Spells) ----------
  function renderList(listEl, items, type) {
    listEl.innerHTML = items
      .map((it, idx) => {
        const right =
          type === "weapon"
            ? `${escapeHtml(it.damage_dice || "")} ${escapeHtml(
                it.damage_type || ""
              )} ${escapeHtml(it.properties || "")}`
            : `Lv ${escapeHtml(it.level ?? "")} • ${escapeHtml(
                it.school || ""
              )} • ${escapeHtml(it.casting_time || "")}`;
        const titleLeft =
          type === "weapon"
            ? `${escapeHtml(it.name)} <span class="sub">(${escapeHtml(
                [it.category, it.weapon_group].filter(Boolean).join(" • ")
              )})</span>`
            : escapeHtml(it.name);
        return `<div class="row">
          <div class="left">
            <div class="title">${titleLeft}</div>
            <div class="sub">${right}</div>
          </div>
          <div class="right">
            <button class="icon danger" data-remove="${idx}" data-type="${type}" title="Remove">✕</button>
          </div>
        </div>`;
      })
      .join("");

    $$("button[data-remove]", listEl).forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.remove);
        const t = btn.dataset.type;
        if (t === "weapon") state.weapons.splice(idx, 1);
        if (t === "spell") state.spells.splice(idx, 1);
        markDirty();
        autosave();
        renderList(listEl, t === "weapon" ? state.weapons : state.spells, t);
      });
    });
  }

  async function setupQuickAdd(type) {
    assertCatalog();
    const isWeapon = type === "weapon";
    const input = $(`#${type}Search`);
    const results = $(`#${type}Results`);
    const list = $(`#${type}List`);
    const addBtn = $(`#${type}AddBtn`);

    renderList(list, isWeapon ? state.weapons : state.spells, type);

    let selected = null;

    async function search(q) {
      const query = q?.trim() || "";
      const method = isWeapon ? "listWeapons" : "listSpells";
      const data = await window.CatalogAPI[method](
        query ? { search: query, limit: 20 } : { limit: 20 }
      );
      results.innerHTML = data
        .map(
          (x, i) => `<button class="result" data-idx="${i}" type="button">
            <div class="title">${escapeHtml(x.name)}</div>
            <div class="sub">${
              isWeapon
                ? `${escapeHtml(x.category || "")}${
                    x.weapon_group ? " • " + escapeHtml(x.weapon_group) : ""
                  } • ${escapeHtml(x.damage_dice || "")} ${escapeHtml(
                    x.damage_type || ""
                  )}`
                : "Lv " +
                  escapeHtml(x.level ?? "") +
                  " • " +
                  escapeHtml(x.school || "")
            }</div>
          </button>`
        )
        .join("");
      const items = data;
      $$(".result", results).forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.idx);
          selected = items[i];
          $$(".result", results).forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
        });
      });
    }

    input.addEventListener(
      "input",
      debounce(() => search(input.value), 250)
    );
    search("");

    addBtn.addEventListener("click", () => {
      if (!selected) return;
      if (isWeapon) {
        const pick = {
          id: selected.id,
          name: selected.name,
          category: selected.category,
          weapon_group: selected.weapon_group,
          damage_dice: selected.damage_dice,
          damage_type: selected.damage_type,
          properties: selected.properties,
          weight: selected.weight,
          cost_gp: selected.cost_gp,
          range_normal: selected.range_normal,
          range_long: selected.range_long,
        };
        if (!state.weapons.some((w) => String(w.id) === String(pick.id))) {
          state.weapons.push(pick);
        }
        renderList(list, state.weapons, "weapon");
      } else {
        const pick = {
          id: selected.id,
          name: selected.name,
          level: selected.level,
          school: selected.school,
          casting_time: selected.casting_time,
        };
        if (!state.spells.some((s) => String(s.id) === String(pick.id))) {
          state.spells.push(pick);
        }
        renderList(list, state.spells, "spell");
      }
      selected = null;
      input.value = "";
      results.innerHTML = "";
      markDirty();
      autosave();
    });
  }

  // ---------- Inventory ----------
  function renderInventory() {
    const root = $("#inventoryList");
    root.innerHTML = state.inventory
      .map(
        (it, idx) => `<div class="row">
          <div class="left">
            <input class="autosave inv-name" data-idx="${idx}" value="${escapeHtml(
          it.name
        )}" placeholder="Item name" />
          </div>
          <div class="right">
            <input class="autosave inv-qty" data-idx="${idx}" type="number" min="0" value="${Number(
          it.qty || 1
        )}" style="width:80px" />
            <button class="icon danger" data-remove="${idx}" title="Remove">✕</button>
          </div>
        </div>`
      )
      .join("");

    $$(".inv-name", root).forEach((inp) =>
      inp.addEventListener("input", () => {
        const i = Number(inp.dataset.idx);
        state.inventory[i].name = inp.value;
        markDirty();
        autosave();
      })
    );
    $$(".inv-qty", root).forEach((inp) =>
      inp.addEventListener("change", () => {
        const i = Number(inp.dataset.idx);
        state.inventory[i].qty = Number(inp.value || 1);
        markDirty();
        autosave();
      })
    );
    $$("button[data-remove]", root).forEach((btn) =>
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.remove);
        state.inventory.splice(i, 1);
        markDirty();
        autosave();
        renderInventory();
      })
    );
  }

  function addInventoryItem() {
    state.inventory.push({ name: "", qty: 1 });
    renderInventory();
    markDirty();
    autosave();
  }

  // ---------- Boot ----------
  function bindMeta() {
    const nameInput = $("#charName");
    const levelInput = $("#charLevel");
    nameInput.value = state.meta.name || "";
    levelInput.value = Number(state.meta.level || 1);

    nameInput.addEventListener("input", () => {
      state.meta.name = nameInput.value;
      markDirty();
      autosave();
    });
    levelInput.addEventListener("change", () => {
      state.meta.level = Math.max(1, Number(levelInput.value || 1));
      markDirty();
      autosave();
    });
  }

  function bindNotes() {
    const notes = $("#notes");
    notes.value = state.notes || "";
    notes.addEventListener("input", () => {
      state.notes = notes.value;
      markDirty();
      autosave();
    });
  }

  function applyBasicStyles() {
    const css = document.createElement("style");
    css.textContent = `
    .sheet { display:grid; gap:16px; }
    .row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; border:1px solid rgba(125,211,252,.25); border-radius:12px; }
    .row .left { flex:1; min-width:0; }
    .row .right { display:flex; align-items:center; gap:8px; }
    .title { font-weight:600; }
    .sub { opacity:.7; font-size:.9em; }
    .ability-grid { display:grid; grid-template-columns: repeat(6, minmax(100px, 1fr)); gap:12px; }
    .ability { border:1px solid rgba(125,211,252,.25); border-radius:12px; padding:12px; text-align:center; }
    .ability input { width:100%; text-align:center; font-size:1.1em; padding:8px; border-radius:8px; border:1px solid rgba(125,211,252,.25); background:transparent; color:inherit; }
    .ability .mod { margin-top:8px; opacity:.8; font-size:.9em; }
    .toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .toolbar input[type="text"] { flex:1; padding:10px; border-radius:10px; border:1px solid rgba(125,211,252,.25); background:transparent; color:inherit; }
    .toolbar button { padding:10px 14px; border-radius:10px; border:1px solid rgba(125,211,252,.25); background:transparent; color:inherit; cursor:pointer; }
    .toolbar button.icon { width:36px; height:36px; display:grid; place-items:center; }
    .toolbar button.danger { border-color:#f00a; }
    .result { width:100%; text-align:left; padding:10px; border-radius:10px; border:1px solid rgba(125,211,252,.25); background:transparent; color:inherit; cursor:pointer; }
    .result + .result { margin-top:8px; }
    .result.selected { outline:2px solid rgba(125,211,252,.9); }
    .tabs { display:flex; gap:8px; border-bottom:1px solid rgba(125,211,252,.25); }
    .tab-btn { padding:10px 14px; cursor:pointer; border:none; background:transparent; color:inherit; opacity:.8; }
    .tab-btn.active { opacity:1; border-bottom:2px solid currentColor; }
    .tab-panel { padding-top:12px; }
    .muted { opacity:.7 }
    #saveStatus { opacity:.6; font-size:.9em; }
    textarea { width:100%; min-height:160px; padding:10px; border-radius:10px; border:1px solid rgba(125,211,252,.25); background:transparent; color:inherit; }
    `;
    document.head.appendChild(css);
  }

  function mountSkeleton() {
    const root = $("#app");
    root.innerHTML = `
      <div class="sheet">
        <div class="toolbar">
          <div style="display:flex; gap:8px; align-items:center; flex:1;">
            <input id="charName" class="autosave" placeholder="Character Name" />
            <input id="charLevel" class="autosave" type="number" min="1" max="20" style="width:100px" />
            <select id="speciesSelect"></select>
            <select id="classSelect"></select>
          </div>
          <div id="saveStatus" class="muted">Saved ✓</div>
        </div>

        <div class="tabs">
          <button class="tab-btn" data-tab="panel-abilities">Abilities</button>
          <button class="tab-btn" data-tab="panel-weapons">Weapons</button>
          <button class="tab-btn" data-tab="panel-spells">Spells</button>
          <button class="tab-btn" data-tab="panel-inventory">Inventory</button>
          <button class="tab-btn" data-tab="panel-notes">Notes</button>
        </div>

        <div id="panel-abilities" class="tab-panel">
          <div id="abilities" class="ability-grid"></div>
        </div>

        <div id="panel-weapons" class="tab-panel">
          <div class="toolbar">
            <input id="weaponSearch" placeholder="Search weapons…" />
            <button id="weaponAddBtn" class="icon" title="Add selected">＋</button>
          </div>
          <div id="weaponResults" style="display:grid; gap:8px;"></div>
          <h4>Selected Weapons</h4>
          <div id="weaponList" style="display:grid; gap:8px;"></div>
        </div>

        <div id="panel-spells" class="tab-panel">
          <div class="toolbar">
            <input id="spellSearch" placeholder="Search spells…" />
            <button id="spellAddBtn" class="icon" title="Add selected">＋</button>
          </div>
          <div id="spellResults" style="display:grid; gap:8px;"></div>
          <h4>Prepared/Chosen Spells</h4>
          <div id="spellList" style="display:grid; gap:8px;"></div>
        </div>

        <div id="panel-inventory" class="tab-panel">
          <div class="toolbar">
            <div class="muted">Add items you carry</div>
            <button id="invAddBtn">Add Item</button>
          </div>
          <div id="inventoryList" style="display:grid; gap:8px;"></div>
        </div>

        <div id="panel-notes" class="tab-panel">
          <textarea id="notes" placeholder="Notes, background, features, traits…"></textarea>
        </div>
      </div>
    `;
  }

  // ---------- Initialize ----------
  async function init() {
    applyBasicStyles();
    mountSkeleton();
    initTabs();

    bindAutoSaveInputs(document);
    bindMeta();
    renderAbilities();
    bindNotes();

    await populateMetaPickers();
    await Promise.all([setupQuickAdd("weapon"), setupQuickAdd("spell")]);

    $("#invAddBtn").addEventListener("click", addInventoryItem);
    renderInventory();

    if (state.meta.name) $("#charName").value = state.meta.name;
    if (state.meta.level) $("#charLevel").value = Number(state.meta.level);

    const firstTab = $(".tab-btn");
    if (firstTab && !$(".tab-btn.active")) firstTab.click();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
