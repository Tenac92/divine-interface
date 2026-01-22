(function () {
  const AppNS = (window.App = window.App || {});
  const Constants = AppNS.SheetConstants;
  if (!Constants) {
    console.error("[Sheet] SheetConstants missing. Load sheet.constants.js first.");
    return;
  }

  const {
    XP_TABLE,
    ABILITIES,
    SKILLS,
    SKILL_ABILITY_MAP,
    SPELL_SCHOOLS,
    DEFAULT_CLASS_OPTIONS,
    DEFAULT_SPECIES_OPTIONS,
  } = Constants;

  const cfg = window.RUNTIME_ENV || {};
  const SUPABASE_URL = cfg.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || "";
  const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

  const HEADERS = () => ({
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
  });

  const buildURL = (table, params = {}) => {
    const url = new URL(SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table));
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value)
    );
    return url.toString();
  };

  async function fetchFaithItems({ search = "", limit = 300 } = {}) {
    if (!HAS_SUPABASE) return [];
    const params = {
      select: "id,name,type,desc,cost,god,active,sort_index",
      order: "sort_index.asc,name.asc",
      limit: String(limit),
      active: "eq.true",
    };
    if (search) params.name = `ilike.*${search}*`;
    try {
      const res = await fetch(buildURL("faith_items", params), {
        headers: HEADERS(),
      });
      const data = await res.json().catch(() => []);
      if (!res.ok || !Array.isArray(data)) return [];
      return data;
    } catch (err) {
      console.warn("[Sheet] fetchFaithItems failed", err);
      return [];
    }
  }

  const randId = () => Math.random().toString(36).slice(2, 10);

  const hasCore = !!(window.Core && typeof window.Core.getSession === "function");
  function getSessionSafe() {
    if (hasCore) return window.Core.getSession();
    return { username: "local-user", role: "player" };
  }

  const hasRemote = !!window.RemoteStore;
  const LS_PROFILES = "di.store.profiles.v1";
  function lsLoadProfiles() {
    try {
      return JSON.parse(localStorage.getItem(LS_PROFILES) || "{}");
    } catch {
      return {};
    }
  }
  function lsSaveProfiles(map) {
    localStorage.setItem(LS_PROFILES, JSON.stringify(map));
  }
  async function loadProfileAny(user) {
    if (hasRemote) return (await window.RemoteStore.loadProfile(user)) || null;
    const map = lsLoadProfiles();
    return map[user] || null;
  }
  async function saveProfileAny(user, prof) {
    if (hasRemote) return window.RemoteStore.saveProfile(user, prof);
    const map = lsLoadProfiles();
    map[user] = prof;
    lsSaveProfiles(map);
    return prof;
  }

  function normalizeSpellSlots(slots) {
    const base = Array.from({ length: 10 }, () => ({ total: 0, used: 0 }));
    if (!Array.isArray(slots)) return base;
    slots.slice(0, base.length).forEach((slot, idx) => {
      const total = Math.max(0, Number(slot?.total ?? 0) || 0);
      let used = Math.max(0, Number(slot?.used ?? 0) || 0);
      if (used > total) used = total;
      base[idx] = { total, used };
    });
    return base;
  }

  function defaultSheet(username) {
    const skills = {};
    SKILLS.forEach((s) => {
      skills[s.key] = false;
    });
    return {
      name: username || "",
      className: "",
      subclass: null,
      species: "",
      background: "",
      level: 1,
      xp: 0,
      inspiration: false,
      ac: 10,
      hp: { current: 10, max: 10, temp: 0 },
      abilities: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      skills,
      inventory: [],
      spells: [],
      spellSlots: normalizeSpellSlots(),
      notes: "",
      updatedAt: null,
    };
  }

  function defaultProfile(username) {
    return {
      id: randId(),
      name: username,
      god: "Tyr/Bahamut",
      level: 1,
      fp: 10,
      owned: [],
      lock: false,
      heroStatus: "",
      heroGreeting: "",
      heroMessage: "",
      sheet: defaultSheet(username),
    };
  }

  function normalizeItems(list) {
    return (Array.isArray(list) ? list : []).map((item) => ({
      id: item?.id || randId(),
      name: item?.name || "",
      qty: Number(item?.qty ?? 1) || 1,
      note: item?.note || "",
    }));
  }

  function normalizeComponents(value) {
    if (Array.isArray(value)) {
      return value.map((part) => String(part || "").trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/[,;/]+/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return [];
  }

  function normalizeSpells(list) {
    return (Array.isArray(list) ? list : []).map((spell) => ({
      id: spell?.id || randId(),
      name: spell?.name || "",
      level: Number(spell?.level ?? 0) || 0,
      prepared: !!spell?.prepared,
      note: spell?.note || "",
      castingTime: spell?.castingTime || spell?.casting_time || "",
      range: spell?.range || "",
      duration: spell?.duration || "",
      school: spell?.school || "",
      components: normalizeComponents(spell?.components),
      materials: spell?.materials || "",
      concentration: !!spell?.concentration,
      ritual: !!spell?.ritual,
      description: spell?.description || spell?.text_md || "",
    }));
  }

  function mergeSheet(username, raw) {
    const base = defaultSheet(username);
    if (!raw) return base;
    return {
      ...base,
      ...raw,
      hp: { ...base.hp, ...(raw.hp || {}) },
      abilities: { ...base.abilities, ...(raw.abilities || {}) },
      skills: { ...base.skills, ...(raw.skills || {}) },
      inventory: normalizeItems(raw.inventory),
      spells: normalizeSpells(raw.spells),
      spellSlots: normalizeSpellSlots(raw.spellSlots),
      updatedAt: raw.updatedAt || raw.updated_at || null,
    };
  }

  function abilityMod(score) {
    const n = Number(score) || 0;
    return Math.floor((n - 10) / 2);
  }

  function levelToProficiency(level) {
    const lvl = Math.min(Math.max(Number(level) || 1, 1), 20);
    return 2 + Math.floor((lvl - 1) / 4);
  }

  function xpForLevel(level) {
    return XP_TABLE[level] || XP_TABLE[20];
  }

  function validateSheet(state) {
    const errs = [];
    if (!state.name || !state.name.trim()) {
      errs.push("Character name is required.");
    }
    const level = Number(state.level) || 1;
    if (level < 1 || level > 20) {
      errs.push("Level must stay between 1 and 20.");
    }
    if (state.ac < 1) {
      errs.push("Armor class must be at least 1.");
    }
    Object.entries(state.abilities || {}).forEach(([key, value]) => {
      const score = Number(value) || 0;
      if (score < 1 || score > 30) {
        errs.push(`${key.toUpperCase()} score should be between 1 and 30.`);
      }
    });
    const current = Number(state.hp?.current ?? 0);
    const max = Number(state.hp?.max ?? 0);
    if (current < 0) errs.push("Current HP cannot be negative.");
    if (max < 1) errs.push("Max HP must be at least 1.");
    if (current > max) errs.push("Current HP cannot exceed Max HP.");
    return errs;
  }

  AppNS.SheetServices = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    HAS_SUPABASE,
    HEADERS,
    buildURL,
    fetchFaithItems,
    randId,
    getSessionSafe,
    loadProfileAny,
    saveProfileAny,
    defaultSheet,
    defaultProfile,
    normalizeItems,
    normalizeComponents,
    normalizeSpells,
    normalizeSpellSlots,
    mergeSheet,
    abilityMod,
    levelToProficiency,
    xpForLevel,
    validateSheet,
  };
})();
