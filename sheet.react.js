(function () {
  const AppNS = (window.App = window.App || {});
  const { useEffect, useMemo, useRef, useState } = React;

  // ---------- Constants ----------
  const XP_TABLE = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
    7: 23000,
    8: 34000,
    9: 48000,
    10: 64000,
    11: 85000,
    12: 100000,
    13: 120000,
    14: 140000,
    15: 165000,
    16: 195000,
    17: 225000,
    18: 265000,
    19: 305000,
    20: 355000,
  };

  const ABILITIES = [
    { key: "str", label: "Strength" },
    { key: "dex", label: "Dexterity" },
    { key: "con", label: "Constitution" },
    { key: "int", label: "Intelligence" },
    { key: "wis", label: "Wisdom" },
    { key: "cha", label: "Charisma" },
  ];

  const SKILLS = [
    { key: "acrobatics", label: "Acrobatics", ability: "Dex" },
    { key: "animal", label: "Animal Handling", ability: "Wis" },
    { key: "arcana", label: "Arcana", ability: "Int" },
    { key: "athletics", label: "Athletics", ability: "Str" },
    { key: "deception", label: "Deception", ability: "Cha" },
    { key: "history", label: "History", ability: "Int" },
    { key: "insight", label: "Insight", ability: "Wis" },
    { key: "intimidation", label: "Intimidation", ability: "Cha" },
    { key: "investigation", label: "Investigation", ability: "Int" },
    { key: "medicine", label: "Medicine", ability: "Wis" },
    { key: "nature", label: "Nature", ability: "Int" },
    { key: "perception", label: "Perception", ability: "Wis" },
    { key: "performance", label: "Performance", ability: "Cha" },
    { key: "persuasion", label: "Persuasion", ability: "Cha" },
    { key: "religion", label: "Religion", ability: "Int" },
    { key: "sleight", label: "Sleight of Hand", ability: "Dex" },
    { key: "stealth", label: "Stealth", ability: "Dex" },
    { key: "survival", label: "Survival", ability: "Wis" },
  ];

  const SPELL_SCHOOLS = [
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
  ];

  const DEFAULT_CLASS_OPTIONS = [
    "Barbarian",
    "Bard",
    "Cleric",
    "Druid",
    "Fighter",
    "Monk",
    "Paladin",
    "Ranger",
    "Rogue",
    "Sorcerer",
    "Warlock",
    "Wizard",
  ];

  const DEFAULT_SPECIES_OPTIONS = [
    "Aasimar",
    "Dragonborn",
    "Dwarf",
    "Elf",
    "Gnome",
    "Half-Elf",
    "Half-Orc",
    "Halfling",
    "Human",
    "Tiefling",
  ];

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

  // ---------- Helpers ----------
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

  function defaultSheet(username) {
    const skills = {};
    SKILLS.forEach((s) => {
      skills[s.key] = false;
    });
    return {
      name: username || "",
      className: "",
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

  // ---------- UI helpers ----------
  const Card = ({ className = "", children, ...rest }) =>
    React.createElement(
      "div",
      { ...rest, className: ["card", className].filter(Boolean).join(" ") },
      children
    );
  const Btn = ({ className = "", children, ...rest }) =>
    React.createElement(
      "button",
      { ...rest, className: ["btn", className].filter(Boolean).join(" ") },
      children
    );
  const Field = ({ label, hint, children }) =>
    React.createElement(
      "label",
      { className: "ui-field" },
      label
        ? React.createElement("span", { className: "ui-label" }, label)
        : null,
      children,
      hint
        ? React.createElement("span", { className: "ui-hint" }, hint)
        : null
    );

  // ---------- Component ----------
  function SheetPage() {
    const session = getSessionSafe();

    if (!session || !session.username) {
      return React.createElement(
        "div",
        { className: "card max-w-lg mx-auto" },
        React.createElement(
          "h2",
          { className: "text-lg font-semibold mb-2" },
          "Login required"
        ),
        React.createElement(
          "p",
          { className: "text-sm opacity-75" },
          "Sign in to manage your character sheet."
        )
      );
    }

    const [profile, setProfile] = useState(null);
    const [sheet, setSheet] = useState(defaultSheet(session.username));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [errors, setErrors] = useState([]);
    const [isCompact, setIsCompact] = useState(() => {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return window.matchMedia("(max-width: 768px)").matches;
    });
    const catalog = AppNS.Catalog || {};
    const [classOptions, setClassOptions] = useState(DEFAULT_CLASS_OPTIONS);
    const [speciesOptions, setSpeciesOptions] = useState(DEFAULT_SPECIES_OPTIONS);
    const [gearSearch, setGearSearch] = useState("");
    const [weaponResults, setWeaponResults] = useState([]);
    const [weaponLoading, setWeaponLoading] = useState(false);
    const weaponFetchId = useRef(0);
    const [storeItems, setStoreItems] = useState([]);
    const [spellSearch, setSpellSearch] = useState("");
    const [spellResults, setSpellResults] = useState([]);
    const [spellLoading, setSpellLoading] = useState(false);
    const spellFetchId = useRef(0);
    const [spellFilterLevel, setSpellFilterLevel] = useState("all");
    const [spellFilterPrepared, setSpellFilterPrepared] = useState("any");
    const [spellCatalogClass, setSpellCatalogClass] = useState("auto");
    const [spellCatalogLevel, setSpellCatalogLevel] = useState("all");
    const [spellCatalogSchool, setSpellCatalogSchool] = useState("any");
    const [spellCatalogRitual, setSpellCatalogRitual] = useState("any");
    const [spellCatalogConcentration, setSpellCatalogConcentration] = useState(
      "any"
    );
    const [spellListSearch, setSpellListSearch] = useState("");
    const [collapsedSpellLevels, setCollapsedSpellLevels] = useState({});
    const [openSpellEditors, setOpenSpellEditors] = useState({});

    const hasClassCatalog = typeof catalog.listClasses === "function";
    const hasSpeciesCatalog = typeof catalog.listSpecies === "function";
    const hasWeaponCatalog = typeof catalog.listWeapons === "function";
    const hasSpellCatalog = typeof catalog.listSpells === "function";
    const hasGearCatalog = hasWeaponCatalog || HAS_SUPABASE;

    useEffect(() => {
      if (typeof window === "undefined" || !window.matchMedia) return undefined;
      const query = window.matchMedia("(max-width: 768px)");
      const updateCompact = (event) => {
        const matches =
          typeof event.matches === "boolean"
            ? event.matches
            : event.currentTarget?.matches;
        setIsCompact(!!matches);
      };
      updateCompact(query);
      if (query.addEventListener) {
        query.addEventListener("change", updateCompact);
      } else {
        query.addListener(updateCompact);
      }
      return () => {
        if (query.removeEventListener) {
          query.removeEventListener("change", updateCompact);
        } else {
          query.removeListener(updateCompact);
        }
      };
    }, []);

    useEffect(() => {
      setErrors(validateSheet(sheet));
    }, [sheet]);

    useEffect(() => {
      if (!hasClassCatalog) return undefined;
      let cancelled = false;
      (async () => {
        try {
          const list = await catalog.listClasses({ limit: 200 });
          if (
            cancelled ||
            !Array.isArray(list) ||
            list.length === 0
          )
            return;
          const normalized = Array.from(
            new Set(
              list
                .map((entry) => (entry?.name || entry?.id || "").trim())
                .filter(Boolean)
            )
          );
          if (normalized.length) setClassOptions(normalized);
        } catch (err) {
          console.warn("[Sheet] load class catalog failed", err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [catalog, hasClassCatalog]);

    useEffect(() => {
      if (!hasSpeciesCatalog) return undefined;
      let cancelled = false;
      (async () => {
        try {
          const list = await catalog.listSpecies({ limit: 200 });
          if (
            cancelled ||
            !Array.isArray(list) ||
            list.length === 0
          )
            return;
          const normalized = Array.from(
            new Set(
              list
                .map((entry) => (entry?.name || entry?.id || "").trim())
                .filter(Boolean)
            )
          );
          if (normalized.length) setSpeciesOptions(normalized);
        } catch (err) {
          console.warn("[Sheet] load species catalog failed", err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [catalog, hasSpeciesCatalog]);

    useEffect(() => {
      if (!HAS_SUPABASE) return undefined;
      let cancelled = false;
      (async () => {
        const data = await fetchFaithItems({ limit: 400 });
        if (!cancelled && Array.isArray(data)) setStoreItems(data);
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        let prof = await loadProfileAny(session.username);
        if (!prof) {
          prof = defaultProfile(session.username);
          await saveProfileAny(session.username, prof);
        }
        if (!prof.sheet) {
          prof = { ...prof, sheet: defaultSheet(session.username) };
          await saveProfileAny(session.username, prof);
        }
        const merged = mergeSheet(session.username, prof.sheet);
        if (!cancelled) {
          setProfile(prof);
          setSheet(merged);
          setDirty(false);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [session.username]);

    useEffect(() => {
      if (!hasWeaponCatalog) return undefined;
      let alive = true;
      const requestId = ++weaponFetchId.current;
      setWeaponLoading(true);
      const delay = gearSearch ? 250 : 30;
      const handle = setTimeout(async () => {
        try {
          const list = await catalog.listWeapons({
            search: gearSearch.trim(),
            limit: 40,
          });
          if (alive && weaponFetchId.current === requestId) {
            setWeaponResults(Array.isArray(list) ? list : []);
          }
        } catch (err) {
          console.warn("[Sheet] weapon catalog lookup failed", err);
          if (alive && weaponFetchId.current === requestId) {
            setWeaponResults([]);
          }
        } finally {
          if (alive && weaponFetchId.current === requestId) {
            setWeaponLoading(false);
          }
        }
      }, delay);
      return () => {
        alive = false;
        clearTimeout(handle);
      };
    }, [catalog, gearSearch, hasWeaponCatalog]);

    useEffect(() => {
      if (!hasSpellCatalog) return undefined;
      let alive = true;
      const requestId = ++spellFetchId.current;
      setSpellLoading(true);
      const delay = spellSearch ? 250 : 30;
      const effectiveClass =
        spellCatalogClass === "auto"
          ? sheet.className || ""
          : spellCatalogClass === "any"
          ? ""
          : spellCatalogClass;
      const levelFilter =
        spellCatalogLevel === "all"
          ? undefined
          : Number(spellCatalogLevel) || 0;
      const schoolFilter =
        spellCatalogSchool === "any" ? "" : spellCatalogSchool;
      const ritualFilter =
        spellCatalogRitual === "any"
          ? undefined
          : spellCatalogRitual === "yes";
      const concentrationFilter =
        spellCatalogConcentration === "any"
          ? undefined
          : spellCatalogConcentration === "yes";
      const handle = setTimeout(async () => {
        try {
          const list = await catalog.listSpells({
            search: spellSearch.trim(),
            limit: 60,
            className: effectiveClass,
            level:
              typeof levelFilter === "number" && spellCatalogLevel !== "all"
                ? levelFilter
                : undefined,
            school: schoolFilter,
            ritual: ritualFilter,
            concentration: concentrationFilter,
          });
          if (alive && spellFetchId.current === requestId) {
            setSpellResults(Array.isArray(list) ? list : []);
          }
        } catch (err) {
          console.warn("[Sheet] spell catalog lookup failed", err);
          if (alive && spellFetchId.current === requestId) {
            setSpellResults([]);
          }
        } finally {
          if (alive && spellFetchId.current === requestId) {
            setSpellLoading(false);
          }
        }
      }, delay);
      return () => {
        alive = false;
        clearTimeout(handle);
      };
    }, [
      catalog,
      hasSpellCatalog,
      spellSearch,
      spellCatalogClass,
      spellCatalogLevel,
      spellCatalogSchool,
      spellCatalogRitual,
      spellCatalogConcentration,
      sheet.className,
    ]);

    const updateSheet = (producer) => {
      setSheet((prev) => {
        const next = producer(prev);
        setDirty(true);
        return next;
      });
    };

    const saveChanges = async () => {
      if (!profile) return;
      setSaving(true);
      try {
        const nextSheet = {
          ...sheet,
          updatedAt: new Date().toISOString(),
        };
        const nextProfile = {
          ...profile,
          name: sheet.name || profile.name,
          sheet: nextSheet,
        };
        await saveProfileAny(session.username, nextProfile);
        setProfile(nextProfile);
        setSheet(nextSheet);
        setDirty(false);
        AppNS.toast && AppNS.toast("Sheet saved.");
      } catch (err) {
        console.error("[Sheet] save failed", err);
        AppNS.toast && AppNS.toast("Saving failed. Try again.");
      } finally {
        setSaving(false);
      }
    };

    const resetDraft = () => {
      if (!profile) return;
      setSheet(mergeSheet(session.username, profile.sheet));
      setDirty(false);
    };

    const gridCols = (desktopPattern) =>
      isCompact ? "1fr" : desktopPattern;
    const proficientCount = useMemo(
      () => Object.values(sheet.skills || {}).filter(Boolean).length,
      [sheet.skills]
    );
    const preparedCount = useMemo(
      () => sheet.spells.filter((spell) => spell.prepared).length,
      [sheet.spells]
    );
    const inventoryCount = sheet.inventory.length;
    const notesPresent = !!(sheet.notes && sheet.notes.trim().length);
    const heroMetaInfo = (() => {
      const parts = [];
      if (sheet.className) parts.push(sheet.className);
      if (sheet.species) parts.push(sheet.species);
      const hasOptionalDetails = parts.length > 0 || !!profile?.god;
      parts.push(`Level ${sheet.level || 1}`);
      if (profile?.god) parts.push(profile.god);
      return { line: parts.join(" | "), hasOptionalDetails };
    })();

    const proficiency = levelToProficiency(sheet.level);
    const abilityMods = useMemo(() => {
      const mods = {};
      ABILITIES.forEach(({ key }) => {
        mods[key] = abilityMod(sheet.abilities?.[key] ?? 10);
      });
      return mods;
    }, [sheet.abilities]);

    const xpFloor = xpForLevel(sheet.level);
    const xpCeil = xpForLevel(Math.min((sheet.level || 1) + 1, 20));
    const xpRange = Math.max(xpCeil - xpFloor, 1);
    const xpProgress = Math.max(
      0,
      Math.min(1, (sheet.xp - xpFloor) / xpRange)
    );
    const spellLevelOptions = useMemo(() => {
      const levels = new Set([0]);
      (Array.isArray(sheet.spells) ? sheet.spells : []).forEach((spell) => {
        const lvl = Number(spell.level ?? 0);
        if (Number.isFinite(lvl)) {
          levels.add(Math.max(0, Math.min(9, Math.floor(lvl))));
        }
      });
      return Array.from(levels)
        .sort((a, b) => a - b)
        .slice(0, 10);
    }, [sheet.spells]);
    const sortedSpells = useMemo(() => {
      const list = Array.isArray(sheet.spells) ? sheet.spells.slice() : [];
      list.sort((a, b) => {
        const lvlA = Number(a?.level ?? 0);
        const lvlB = Number(b?.level ?? 0);
        if (lvlA !== lvlB) return lvlA - lvlB;
        const nameA = (a?.name || "").toLocaleLowerCase();
        const nameB = (b?.name || "").toLocaleLowerCase();
        return nameA.localeCompare(nameB);
      });
      return list;
    }, [sheet.spells]);
    const filteredSpells = useMemo(() => {
      const terms = spellListSearch
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      return sortedSpells.filter((spell) => {
        const lvl = Number(spell.level ?? 0);
        if (
          spellFilterLevel !== "all" &&
          lvl !== Number(spellFilterLevel || 0)
        ) {
          return false;
        }
        if (spellFilterPrepared === "prepared" && !spell.prepared) return false;
        if (spellFilterPrepared === "unprepared" && spell.prepared) return false;
        if (terms.length) {
          const haystack = [
            spell.name,
            spell.school,
            spell.description,
            spell.note,
            spell.range,
            spell.duration,
            Array.isArray(spell.tags) ? spell.tags.join(" ") : "",
          ]
            .map((val) => (val || "").toString().toLowerCase())
            .join(" ");
          if (!terms.every((term) => haystack.includes(term))) return false;
        }
        return true;
      });
    }, [
      sortedSpells,
      spellFilterLevel,
      spellFilterPrepared,
      spellListSearch,
    ]);
    const groupedSpells = useMemo(() => {
      const map = new Map();
      filteredSpells.forEach((spell) => {
        const lvl = Number(spell.level ?? 0);
        const key = Number.isFinite(lvl) ? Math.max(0, Math.min(9, lvl)) : 0;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(spell);
      });
      return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    }, [filteredSpells]);
    const knownSpellNames = useMemo(
      () =>
        new Set(
          (sheet.spells || []).map((spell) =>
            (spell.name || "").toLowerCase()
          )
        ),
      [sheet.spells]
    );
    const weaponSuggestions = useMemo(() => {
      if (!hasWeaponCatalog) return [];
      const limit = gearSearch ? 10 : 6;
      return weaponResults.slice(0, limit);
    }, [gearSearch, hasWeaponCatalog, weaponResults]);
    const storeItemSuggestions = useMemo(() => {
      if (!storeItems.length) return [];
      const q = gearSearch.trim().toLowerCase();
      if (!q) return storeItems.slice(0, 6);
      const terms = q.split(/\s+/).filter(Boolean);
      return storeItems
        .filter((item) => {
          if (!terms.length) return true;
          const haystack = [item.name, item.type, item.desc]
            .map((val) => (val || "").toLowerCase())
            .join(" ");
          return terms.every((term) => haystack.includes(term));
        })
        .slice(0, 10);
    }, [gearSearch, storeItems]);
    const spellSuggestions = useMemo(() => {
      if (!hasSpellCatalog || !spellResults.length) return [];
      const seen = new Set();
      const filtered = spellResults.filter((spell) => {
        const name = (spell?.name || "").trim();
        if (!name) return false;
        const key = name.toLowerCase();
        if (knownSpellNames.has(key)) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const limit = spellSearch ? 12 : 8;
      return filtered.slice(0, limit);
    }, [hasSpellCatalog, knownSpellNames, spellResults, spellSearch]);

    const spellStats = useMemo(() => {
      const list = Array.isArray(sheet.spells) ? sheet.spells : [];
      let prepared = 0;
      let rituals = 0;
      let concentration = 0;
      list.forEach((spell) => {
        if (spell.prepared) prepared += 1;
        if (spell.ritual) rituals += 1;
        if (spell.concentration) concentration += 1;
      });
      const total = list.length;
      const preparedPct = total ? Math.round((prepared / total) * 100) : 0;
      return { total, prepared, rituals, concentration, preparedPct };
    }, [sheet.spells]);

    const toggleSpellLevelCollapse = (level) => {
      const key = String(level);
      setCollapsedSpellLevels((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    };

    const isLevelCollapsed = (level) =>
      !!collapsedSpellLevels[String(level)];

    const toggleSpellEditor = (id) =>
      setOpenSpellEditors((prev) => ({
        ...prev,
        [id]: !prev[id],
      }));

    const isSpellEditorOpen = (id) => !!openSpellEditors[id];

    const describeWeapon = (weapon) => {
      if (!weapon) return "";
      const parts = [];
      const damage = [weapon.damage_dice, weapon.damage_type]
        .map((v) => (v || "").trim())
        .filter(Boolean)
        .join(" ");
      if (damage) parts.push(damage);
      if (weapon.range_normal) {
        const range =
          weapon.range_long && weapon.range_long !== weapon.range_normal
            ? `${weapon.range_normal}/${weapon.range_long} ft`
            : `${weapon.range_normal} ft`;
        parts.push(`Range ${range}`);
      }
      if (weapon.weapon_group) parts.push(weapon.weapon_group);
      if (weapon.category) parts.push(weapon.category);
      if (weapon.properties) {
        const props = Array.isArray(weapon.properties)
          ? weapon.properties.join(", ")
          : String(weapon.properties);
        if (props) parts.push(props);
      }
      return parts.filter(Boolean).join(" | ");
    };

    const describeStoreItem = (item) => {
      if (!item) return "";
      const parts = [];
      if (item.type) parts.push(item.type);
      if (item.cost != null) parts.push(`${item.cost} FP`);
      if (item.desc) parts.push(item.desc.trim());
      return parts.filter(Boolean).join(" | ");
    };

    const formatStoreMeta = (item) => {
      const parts = [];
      if (item.type) parts.push(item.type);
      if (item.cost != null) parts.push(`${item.cost} FP`);
      return parts.filter(Boolean).join(" | ");
    };

  const formatWeaponMeta = (weapon) => {
    const parts = [];
    const damage = [weapon.damage_dice, weapon.damage_type]
      .map((v) => (v || "").trim())
      .filter(Boolean)
      .join(" ");
    if (damage) parts.push(damage);
    if (weapon.category) parts.push(weapon.category);
    return parts.filter(Boolean).join(" | ");
  };

  const spellCatalogTags = (spell) => {
    const tags = [];
    tags.push(levelLabel(Number(spell.level ?? 0)));
    if (spell.school) tags.push(spell.school);
    if (spell.ritual) tags.push("Ritual");
    if (spell.concentration) tags.push("Concentration");
    return tags.filter(Boolean).join(" | ");
  };

  const spellCatalogMetaLine = (spell) =>
    [
      spell.casting_time || spell.castingTime || "",
      spell.range || "",
      spell.duration || "",
    ]
      .map((val) => (val || "").trim())
      .filter(Boolean)
      .join(" | ");

  const spellCatalogComponents = (spell) => {
    const comps = normalizeComponents(spell.components);
    const parts = [];
    if (comps.length) parts.push(comps.join(", "));
    if (spell.materials) parts.push(`Materials: ${spell.materials}`);
    return parts.join(" | ");
  };

    const levelLabel = (lvl) => (lvl <= 0 ? "Cantrips" : `Level ${lvl}`);
    const preparedFilterOptions = [
      { id: "any", label: "All" },
      { id: "prepared", label: "Prepared" },
      { id: "unprepared", label: "Unprepared" },
    ];

    const setPreparedForLevel = (level, prepared) =>
      updateSheet((prev) => ({
        ...prev,
        spells: (Array.isArray(prev.spells) ? prev.spells : []).map((spell) => {
          const lvl = Number(spell.level ?? 0);
          if (Number.isFinite(level) && lvl === level) {
            return { ...spell, prepared };
          }
          return spell;
        }),
      }));

    const totalSpells = sortedSpells.length;
    const filteredSpellCount = filteredSpells.length;
    const spellLevelStats = useMemo(() => {
      const stats = new Map();
      sortedSpells.forEach((spell) => {
        const lvl = Number(spell.level ?? 0);
        const key = Number.isFinite(lvl) ? Math.max(0, Math.min(9, lvl)) : 0;
        if (!stats.has(key)) stats.set(key, { total: 0, prepared: 0 });
        const entry = stats.get(key);
        entry.total += 1;
        if (spell.prepared) entry.prepared += 1;
      });
      return stats;
    }, [sortedSpells]);

    const filtersActive =
      spellFilterLevel !== "all" ||
      spellFilterPrepared !== "any" ||
      !!spellListSearch.trim();
    const resetSpellFilters = () => {
      setSpellFilterLevel("all");
      setSpellFilterPrepared("any");
      setSpellListSearch("");
    };

    const addInventoryFromStore = (item) =>
      updateSheet((prev) => {
        if (!item || !item.name) return prev;
        const list = Array.isArray(prev.inventory)
          ? prev.inventory.slice()
          : [];
        const key = item.name.toLowerCase();
        const note = describeStoreItem(item);
        const ix = list.findIndex(
          (entry) => (entry.name || "").toLowerCase() === key
        );
        if (ix >= 0) {
          const existing = { ...list[ix] };
          existing.qty = (existing.qty ?? 1) + 1;
          if (!existing.note && note) existing.note = note;
          list[ix] = existing;
        } else {
          list.push({
            id: randId(),
            name: item.name,
            qty: 1,
            note,
          });
        }
        return { ...prev, inventory: list };
      });

    const addInventoryFromWeapon = (weapon) =>
      updateSheet((prev) => {
        if (!weapon || !weapon.name) return prev;
        const list = Array.isArray(prev.inventory)
          ? prev.inventory.slice()
          : [];
        const key = weapon.name.toLowerCase();
        const note = describeWeapon(weapon);
        const ix = list.findIndex(
          (entry) => (entry.name || "").toLowerCase() === key
        );
        if (ix >= 0) {
          const existing = { ...list[ix] };
          existing.qty = (existing.qty ?? 1) + 1;
          if (!existing.note && note) existing.note = note;
          list[ix] = existing;
        } else {
          list.push({
            id: randId(),
            name: weapon.name,
            qty: 1,
            note,
          });
        }
        return { ...prev, inventory: list };
      });

    const addSpellFromCatalog = (spell) =>
      updateSheet((prev) => {
        if (!spell || !spell.name) return prev;
        const name = spell.name.trim();
        if (!name) return prev;
        const key = name.toLowerCase();
        if ((prev.spells || []).some((sp) => (sp.name || "").toLowerCase() === key))
          return prev;
        const castingTime = (spell.casting_time || spell.castingTime || "").trim();
        const range = (spell.range || "").trim();
        const duration = (spell.duration || "").trim();
        const school = (spell.school || "").trim();
        const components = normalizeComponents(spell.components);
        const materials = (spell.materials || "").trim();
        const note = [school, castingTime]
          .map((val) => (val || "").trim())
          .filter(Boolean)
          .join(" | ");
        return {
          ...prev,
          spells: [
            ...prev.spells,
            {
              id: randId(),
              name,
              level: Number(spell.level ?? 0) || 0,
              prepared: false,
              note,
              castingTime,
              range,
              duration,
              school,
              components,
              materials,
              concentration: !!spell.concentration,
              ritual: !!spell.ritual,
              description: (spell.text_md || spell.description || "").trim(),
            },
          ],
        };
      });

    const addInventoryItem = () =>
      updateSheet((prev) => ({
        ...prev,
        inventory: [
          ...prev.inventory,
          { id: randId(), name: "", qty: 1, note: "" },
        ],
      }));

    const updateInventoryItem = (id, field, value) =>
      updateSheet((prev) => ({
        ...prev,
        inventory: prev.inventory.map((it) =>
          it.id === id ? { ...it, [field]: value } : it
        ),
      }));

    const removeInventoryItem = (id) =>
      updateSheet((prev) => ({
        ...prev,
        inventory: prev.inventory.filter((it) => it.id !== id),
      }));

    const addSpell = () =>
      updateSheet((prev) => ({
        ...prev,
        spells: [
          ...prev.spells,
          {
            id: randId(),
            name: "",
            level: 0,
            prepared: false,
            note: "",
            castingTime: "",
            range: "",
            duration: "",
            school: "",
            components: [],
            materials: "",
            concentration: false,
            ritual: false,
            description: "",
          },
        ],
      }));

    const updateSpell = (id, patch) =>
      updateSheet((prev) => ({
        ...prev,
        spells: prev.spells.map((sp) =>
          sp.id === id ? { ...sp, ...patch } : sp
        ),
      }));

    const removeSpell = (id) =>
      updateSheet((prev) => ({
        ...prev,
        spells: prev.spells.filter((sp) => sp.id !== id),
      }));

    const toggleSkill = (key) =>
      updateSheet((prev) => ({
        ...prev,
        skills: {
          ...prev.skills,
          [key]: !prev.skills?.[key],
        },
      }));

    if (loading) {
      return React.createElement(
        "div",
        { className: "card max-w-lg mx-auto" },
        "Loading character sheet..."
      );
    }

    const canSave = dirty && !saving && errors.length === 0;
    const savedAtLabel = sheet.updatedAt
      ? `Last saved ${new Date(sheet.updatedAt).toLocaleString()}`
      : null;

    const errorBanner =
      errors.length === 0
        ? null
        : Card({
            style: {
              border: "1px solid rgba(239, 68, 68, 0.4)",
              background: "rgba(239, 68, 68, 0.12)",
            },
            children: React.createElement(
              "div",
              { className: "space-y-2" },
              React.createElement(
                "div",
                {
                  style: {
                    fontWeight: 600,
                    color: "#fca5a5",
                  },
                },
                "Resolve these issues before saving:"
              ),
              React.createElement(
                "ul",
                { className: "list-disc pl-5 text-sm space-y-1" },
                errors.map((err, idx) =>
                  React.createElement("li", { key: idx }, err)
                )
              )
            ),
          });

    const heroCard = Card({
      className: "sheet-hero grid gap-4",
      children: React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          { className: "sheet-hero-header" },
          React.createElement(
            "div",
            { className: "sheet-hero-name" },
            sheet.name?.trim() || session.username || "Unnamed Legend"
          ),
          React.createElement(
            "div",
            { className: "sheet-hero-meta" },
            heroMetaInfo.hasOptionalDetails
              ? heroMetaInfo.line
              : "Complete the basics below to define your legend."
          )
        ),
        React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gap: 12,
              gridTemplateColumns: gridCols(
                "repeat(auto-fit, minmax(180px, 1fr))"
              ),
            },
          },
          Field({
            label: "Character Name",
            children: React.createElement("input", {
              className: "ui-input",
              value: sheet.name,
              onChange: (e) =>
                updateSheet((prev) => ({ ...prev, name: e.target.value })),
              placeholder: "Tyrion Shadeheart",
            }),
          }),
          Field({
            label: "Class",
            children: React.createElement(
              "select",
              {
                className: "ui-select",
                value: sheet.className || "",
                onChange: (e) =>
                  updateSheet((prev) => ({
                    ...prev,
                    className: e.target.value,
                  })),
              },
              [
                React.createElement(
                  "option",
                  { key: "blank", value: "" },
                  "Select class"
                ),
                ...classOptions.map((opt) =>
                  React.createElement("option", { key: opt, value: opt }, opt)
                ),
              ]
            ),
          }),
          Field({
            label: "Species",
            children: React.createElement(
              "select",
              {
                className: "ui-select",
                value: sheet.species || "",
                onChange: (e) =>
                  updateSheet((prev) => ({
                    ...prev,
                    species: e.target.value,
                  })),
              },
              [
                React.createElement(
                  "option",
                  { key: "blank", value: "" },
                  "Select lineage"
                ),
                ...speciesOptions.map((opt) =>
                  React.createElement("option", { key: opt, value: opt }, opt)
                ),
              ]
            ),
          }),
          Field({
            label: "Background",
            children: React.createElement("input", {
              className: "ui-input",
              value: sheet.background || "",
              onChange: (e) =>
                updateSheet((prev) => ({
                  ...prev,
                  background: e.target.value,
                })),
              placeholder: "Haunted One",
            }),
          })
        ),
        React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gap: 12,
              gridTemplateColumns: gridCols(
                "repeat(auto-fit, minmax(140px, 1fr))"
              ),
            },
          },
          Field({
            label: "Level",
            hint: "Adjusting level updates proficiency",
            children: React.createElement("input", {
              className: "ui-input",
              type: "number",
              min: 1,
              max: 20,
              value: sheet.level,
              onChange: (e) => {
                const lvl = Math.max(
                  1,
                  Math.min(20, Number(e.target.value) || 1)
                );
                updateSheet((prev) => ({
                  ...prev,
                  level: lvl,
                }));
              },
            }),
          }),
          Field({
            label: "Proficiency",
            children: React.createElement(
              "div",
              { className: "ui-static", style: { fontWeight: 600 } },
              React.createElement("span", null, `+${proficiency}`),
              React.createElement(
                "span",
                { className: "ui-hint", style: { textTransform: "none" } },
                "Auto-calculated"
              )
            ),
          }),
          Field({
            label: "Armor Class",
            children: React.createElement("input", {
              className: "ui-input",
              type: "number",
              min: 1,
              value: sheet.ac,
              onChange: (e) =>
                updateSheet((prev) => ({
                  ...prev,
                  ac: Math.max(1, Number(e.target.value) || 1),
                })),
            }),
          }),
          Field({
            label: "Inspiration",
            children: React.createElement(
              Btn,
              {
                type: "button",
                className: sheet.inspiration ? "tab-btn-active" : "",
                onClick: () =>
                  updateSheet((prev) => ({
                    ...prev,
                    inspiration: !prev.inspiration,
                  })),
              },
              sheet.inspiration ? "Inspired" : "Not inspired"
            ),
          })
        ),
        React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gap: 12,
              gridTemplateColumns: gridCols(
                "repeat(auto-fit, minmax(160px, 1fr))"
              ),
            },
          },
          Field({
            label: "Max HP",
            children: React.createElement("input", {
              className: "ui-input",
              type: "number",
              min: 1,
              value: sheet.hp?.max ?? 0,
              onChange: (e) =>
                updateSheet((prev) => ({
                  ...prev,
                  hp: {
                    ...prev.hp,
                    max: Math.max(1, Number(e.target.value) || 1),
                  },
                })),
            }),
          }),
          Field({
            label: "Current HP",
            children: React.createElement("input", {
              className: "ui-input",
              type: "number",
              value: sheet.hp?.current ?? 0,
              onChange: (e) =>
                updateSheet((prev) => ({
                  ...prev,
                  hp: {
                    ...prev.hp,
                    current: Number(e.target.value) || 0,
                  },
                })),
            }),
          }),
          Field({
            label: "Temp HP",
            children: React.createElement("input", {
              className: "ui-input",
              type: "number",
              value: sheet.hp?.temp ?? 0,
              onChange: (e) =>
                updateSheet((prev) => ({
                  ...prev,
                  hp: {
                    ...prev.hp,
                    temp: Number(e.target.value) || 0,
                  },
                })),
            }),
          })
        ),
        Field({
          label: "Experience",
          hint: `Next level at ${xpCeil.toLocaleString()} XP`,
          children: React.createElement(
            "div",
            { className: "grid gap-2" },
            React.createElement("input", {
              className: "ui-input",
              type: "number",
              min: 0,
              value: sheet.xp,
              onChange: (e) =>
                updateSheet((prev) => ({
                  ...prev,
                  xp: Math.max(0, Number(e.target.value) || 0),
                })),
            }),
            React.createElement(
              "div",
              {
                style: {
                  position: "relative",
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(125, 211, 252, 0.12)",
                  overflow: "hidden",
                },
              },
              React.createElement("div", {
                style: {
                  width: `${Math.round(xpProgress * 100)}%`,
                  height: "100%",
                  background: "rgba(125, 211, 252, 0.65)",
                },
              })
            )
          ),
        })
      ),
    });

    const actionBar = React.createElement(
      "div",
      { className: "sheet-action-footer" },
      React.createElement(
        Btn,
        {
          type: "button",
          onClick: saveChanges,
          disabled: !canSave,
          className: dirty ? "btn-primary" : "",
        },
        saving ? "Saving..." : "Save changes"
      ),
      React.createElement(
        Btn,
        {
          type: "button",
          onClick: resetDraft,
          disabled: !dirty || saving,
          className: "btn-muted",
        },
        "Reset"
      ),
      savedAtLabel &&
        React.createElement(
          "span",
          { className: "sheet-action-timestamp" },
          savedAtLabel
        )
    );

    const overviewTab = React.createElement(
      "div",
      { className: "grid gap-3" },
      Card({
        children: React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gap: 12,
              gridTemplateColumns: gridCols(
                "repeat(auto-fit, minmax(160px, 1fr))"
              ),
            },
          },
          [
            ["Armor Class", sheet.ac],
            ["HP", `${sheet.hp.current ?? 0}/${sheet.hp.max ?? 0}`],
            ["Temp HP", sheet.hp.temp ?? 0],
            ["Inspiration", sheet.inspiration ? "Yes" : "No"],
            ["XP", sheet.xp.toLocaleString()],
            ["Next Level", xpCeil.toLocaleString()],
          ].map(([label, value]) =>
            React.createElement(
              "div",
              {
                key: label,
                style: {
                  display: "grid",
                  gap: 4,
                  padding: "0.65rem",
                  borderRadius: 12,
                  border: "1px solid rgba(125, 211, 252, 0.2)",
                },
              },
              React.createElement("span", { className: "ui-label" }, label),
              React.createElement(
                "span",
                { style: { fontWeight: 600, fontSize: "1.1rem" } },
                value
              )
            )
          )
        ),
      }),
      Card({
        children: React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 12,
            gridTemplateColumns: gridCols(
              "repeat(auto-fit, minmax(140px, 1fr))"
            ),
          },
        },
          ABILITIES.map(({ key, label }) => {
            const score = sheet.abilities?.[key] ?? 10;
            const mod = abilityMods[key];
            return React.createElement(
              "div",
              {
                key: key,
                style: {
                  border: "1px solid rgba(125,211,252,0.2)",
                  borderRadius: 12,
                  padding: "0.75rem",
                  display: "grid",
                  gap: 6,
                  textAlign: "center",
                },
              },
              React.createElement(
                "div",
                { className: "ui-label", style: { textTransform: "uppercase" } },
                label
              ),
              React.createElement(
                "div",
                { style: { fontSize: 28, fontWeight: 700 } },
                score
              ),
              React.createElement(
                "div",
                {
                  className: "tag",
                  style: { justifyContent: "center", margin: "0 auto" },
                },
                mod >= 0 ? `+${mod}` : mod
              )
            );
          })
        ),
      })
    );

    const abilitiesTab = Card({
      children: React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 12,
            gridTemplateColumns: gridCols(
              "repeat(auto-fit, minmax(160px, 1fr))"
            ),
          },
        },
        ABILITIES.map(({ key, label }) => {
          const score = sheet.abilities?.[key] ?? 10;
          const mod = abilityMods[key];
          return React.createElement(
            "div",
            {
              key: key,
              style: {
                border: "1px solid rgba(125,211,252,0.2)",
                borderRadius: 12,
                padding: "0.75rem",
                display: "grid",
                gap: 6,
              },
            },
            React.createElement(
              "div",
              { className: "ui-label", style: { textTransform: "uppercase" } },
              label
            ),
            React.createElement(
              "div",
              { style: { fontSize: 24, fontWeight: 700 } },
              score
            ),
            React.createElement(
              "div",
              { className: "ui-hint" },
              `Modifier ${mod >= 0 ? "+" : ""}${mod}`
            ),
            React.createElement("input", {
              className: "ui-input",
              type: "number",
              min: 1,
              max: 30,
              value: score,
              onChange: (e) =>
                updateSheet((prev) => ({
                  ...prev,
                  abilities: {
                    ...prev.abilities,
                    [key]: Number(e.target.value) || 0,
                  },
                })),
            })
          );
        })
      ),
    });

    const skillsTab = Card({
      children: React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 8,
            gridTemplateColumns: gridCols(
              "repeat(auto-fit, minmax(160px, 1fr))"
            ),
          },
        },
        SKILLS.map((skill) =>
          React.createElement(
            "button",
            {
              key: skill.key,
              type: "button",
              className: sheet.skills?.[skill.key] ? "tab-btn-active" : "",
              style: {
                justifyContent: "space-between",
                display: "flex",
                width: isCompact ? "100%" : undefined,
              },
              onClick: () => toggleSkill(skill.key),
            },
            React.createElement("span", null, skill.label),
            React.createElement(
              "span",
              { className: "ui-hint", style: { textTransform: "none" } },
              skill.ability
            )
          )
        )
      ),
    });

    const gearCatalogSection = !hasGearCatalog
      ? null
      : React.createElement(
          "div",
          { className: "grid gap-2" },
          Field({
            label: "Catalog search",
            hint: "Pull equipment from sanctum relics and weapon compendium.",
            children: React.createElement("input", {
              className: "ui-input",
              value: gearSearch,
              onChange: (e) => setGearSearch(e.target.value),
              placeholder: "Search 'Longsword', 'Divine Guardian', ...",
            }),
          }),
          weaponLoading && (gearSearch || hasWeaponCatalog)
            ? React.createElement(
                "div",
                { className: "ui-hint" },
                gearSearch ? "Searching catalog..." : "Loading catalog gear..."
              )
            : null,
          storeItemSuggestions.length
            ? React.createElement(
                "div",
                { className: "sheet-suggestion-group" },
                React.createElement(
                  "div",
                  { className: "sheet-suggestion-title" },
                  gearSearch ? "Matching relics" : "Sanctum relics"
                ),
                React.createElement(
                  "div",
                  { className: "sheet-suggestion-list" },
                  storeItemSuggestions.map((item) =>
                    React.createElement(
                      "button",
                      {
                        key: item.id,
                        type: "button",
                        className: "sheet-suggestion-btn",
                        onClick: () => addInventoryFromStore(item),
                        title: item.desc || undefined,
                      },
                      React.createElement("span", null, item.name),
                      formatStoreMeta(item)
                        ? React.createElement(
                            "span",
                            { className: "sheet-suggestion-meta" },
                            formatStoreMeta(item)
                          )
                        : null
                    )
                  )
                )
              )
            : null,
          weaponSuggestions.length
            ? React.createElement(
                "div",
                { className: "sheet-suggestion-group" },
                React.createElement(
                  "div",
                  { className: "sheet-suggestion-title" },
                  gearSearch ? "Matching weapons" : "Weapon quick-add"
                ),
                React.createElement(
                  "div",
                  { className: "sheet-suggestion-list" },
                  weaponSuggestions.map((weapon) =>
                    React.createElement(
                      "button",
                      {
                        key: weapon.id || weapon.name,
                        type: "button",
                        className: "sheet-suggestion-btn",
                        onClick: () => addInventoryFromWeapon(weapon),
                        title: describeWeapon(weapon),
                      },
                      React.createElement("span", null, weapon.name),
                      formatWeaponMeta(weapon)
                        ? React.createElement(
                            "span",
                            { className: "sheet-suggestion-meta" },
                            formatWeaponMeta(weapon)
                          )
                        : null
                    )
                  )
                )
              )
            : null,
          !gearSearch &&
            !storeItemSuggestions.length &&
            HAS_SUPABASE &&
            storeItems.length === 0
            ? React.createElement(
                "div",
                { className: "ui-hint" },
                "Loading relics from the database..."
              )
            : null,
          gearSearch &&
            !weaponLoading &&
            !storeItemSuggestions.length &&
            !weaponSuggestions.length
            ? React.createElement(
                "div",
                { className: "ui-hint" },
                "No catalog gear found yet."
              )
            : null
        );

    const inventoryTab = Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        gearCatalogSection,
        sheet.inventory.length === 0
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              "No gear yet. Add what your character carries."
            )
          : sheet.inventory.map((item) =>
              React.createElement(
                "div",
                {
                  key: item.id,
                  style: {
                    border: "1px solid rgba(125,211,252,0.2)",
                    borderRadius: 12,
                    padding: "0.75rem",
                    display: "grid",
                    gap: 8,
                  },
                },
                Field({
                  label: "Item name",
                  children: React.createElement("input", {
                    className: "ui-input",
                    value: item.name,
                    onChange: (e) =>
                      updateInventoryItem(item.id, "name", e.target.value),
                  }),
                }),
                Field({
                  label: "Quantity",
                  children: React.createElement("input", {
                    className: "ui-input",
                    type: "number",
                    min: 0,
                    value: item.qty,
                    onChange: (e) =>
                      updateInventoryItem(
                        item.id,
                        "qty",
                        Math.max(0, Number(e.target.value) || 0)
                      ),
                  }),
                }),
                Field({
                  label: "Notes",
                  children: React.createElement("input", {
                    className: "ui-input",
                    value: item.note,
                    placeholder: "Properties, weight, effects...",
                    onChange: (e) =>
                      updateInventoryItem(item.id, "note", e.target.value),
                  }),
                }),
                React.createElement(
                  Btn,
                  {
                    type: "button",
                    onClick: () => removeInventoryItem(item.id),
                  },
                  "Remove item"
                )
              )
            ),
        React.createElement(
          Btn,
          { type: "button", onClick: addInventoryItem },
          "+ Add item"
        )
      ),
    });

    const spellCatalogSection = !hasSpellCatalog
      ? null
      : React.createElement(
          "div",
          { className: "grid gap-2" },
          Field({
            label: "Spell catalog search",
            hint: "Tap a spell to add it to your list.",
            children: React.createElement("input", {
              className: "ui-input",
              value: spellSearch,
              onChange: (e) => setSpellSearch(e.target.value),
              placeholder: "Search 'Guiding Bolt', 'Shield', ...",
            }),
          }),
          Field({
            label: "Class filter",
            hint:
              spellCatalogClass === "auto"
                ? sheet.className
                  ? `Filtering for ${sheet.className}`
                  : "No class selected on the sheet."
                : null,
            children: React.createElement(
              "select",
              {
                className: "ui-select",
                value: spellCatalogClass,
                onChange: (e) => setSpellCatalogClass(e.target.value),
              },
              [
                React.createElement(
                  "option",
                  { key: "auto", value: "auto" },
                  "Character class (auto)"
                ),
                React.createElement(
                  "option",
                  { key: "any", value: "any" },
                  "All classes"
                ),
                ...classOptions.map((opt) =>
                  React.createElement("option", { key: opt, value: opt }, opt)
                ),
              ]
            ),
          }),
          Field({
            label: "Spell level",
            children: React.createElement(
              "select",
              {
                className: "ui-select",
                value: spellCatalogLevel,
                onChange: (e) => setSpellCatalogLevel(e.target.value),
              },
              [
                React.createElement(
                  "option",
                  { key: "all", value: "all" },
                  "All levels"
                ),
                ...Array.from({ length: 10 }, (_, lvl) =>
                  React.createElement(
                    "option",
                    { key: lvl, value: String(lvl) },
                    lvl === 0 ? "Cantrip (0)" : `Level ${lvl}`
                  )
                ),
              ]
            ),
          }),
          Field({
            label: "School",
            children: React.createElement(
              "select",
              {
                className: "ui-select",
                value: spellCatalogSchool,
                onChange: (e) => setSpellCatalogSchool(e.target.value),
              },
              [
                React.createElement(
                  "option",
                  { key: "any", value: "any" },
                  "All schools"
                ),
                ...SPELL_SCHOOLS.map((school) =>
                  React.createElement(
                    "option",
                    { key: school, value: school },
                    school
                  )
                ),
              ]
            ),
          }),
          Field({
            label: "Concentration",
            children: React.createElement(
              "div",
              { className: "sheet-spell-filter-buttons" },
              [
                { id: "any", label: "Any" },
                { id: "yes", label: "Yes" },
                { id: "no", label: "No" },
              ].map((opt) =>
                React.createElement(
                  "button",
                  {
                    key: opt.id,
                    type: "button",
                    className: `sheet-spell-filter-btn ${
                      spellCatalogConcentration === opt.id ? "active" : ""
                    }`,
                    onClick: () => setSpellCatalogConcentration(opt.id),
                  },
                  opt.label
                )
              )
            ),
          }),
          Field({
            label: "Ritual",
            children: React.createElement(
              "div",
              { className: "sheet-spell-filter-buttons" },
              [
                { id: "any", label: "Any" },
                { id: "yes", label: "Yes" },
                { id: "no", label: "No" },
              ].map((opt) =>
                React.createElement(
                  "button",
                  {
                    key: opt.id,
                    type: "button",
                    className: `sheet-spell-filter-btn ${
                      spellCatalogRitual === opt.id ? "active" : ""
                    }`,
                    onClick: () => setSpellCatalogRitual(opt.id),
                  },
                  opt.label
                )
              )
            ),
          }),
          spellLoading
            ? React.createElement(
                "div",
                { className: "ui-hint" },
                spellSearch ? "Searching spells..." : "Loading spell index..."
              )
            : null,
          spellSuggestions.length
            ? React.createElement(
                "div",
                { className: "sheet-suggestion-group" },
                React.createElement(
                  "div",
                  { className: "sheet-suggestion-title" },
                  spellSearch ? "Matching spells" : "Spell quick-add"
                ),
                React.createElement(
                  "div",
                  { className: "sheet-suggestion-list" },
                  spellSuggestions.map((spell) => {
                    const tags = spellCatalogTags(spell);
                    const meta = spellCatalogMetaLine(spell);
                    const comps = spellCatalogComponents(spell);
                    return React.createElement(
                      "button",
                      {
                        key: spell.id || spell.name,
                        type: "button",
                        className: "sheet-suggestion-btn",
                        onClick: () => addSpellFromCatalog(spell),
                        title: spell.casting_time || undefined,
                      },
                      React.createElement(
                        "div",
                        { className: "sheet-suggestion-content" },
                        React.createElement(
                          "div",
                          { className: "sheet-suggestion-title-row" },
                          React.createElement(
                            "span",
                            { className: "sheet-suggestion-name" },
                            spell.name
                          ),
                          tags
                            ? React.createElement(
                                "span",
                                { className: "sheet-suggestion-meta" },
                                tags
                              )
                            : null
                        ),
                        meta
                          ? React.createElement(
                              "div",
                              { className: "sheet-suggestion-sub" },
                              meta
                            )
                          : null,
                        comps
                          ? React.createElement(
                              "div",
                              { className: "sheet-suggestion-sub" },
                              comps
                            )
                          : null
                      )
                    );
                  })
                )
              )
            : null,
          spellSearch &&
            !spellLoading &&
            !spellSuggestions.length
            ? React.createElement(
                "div",
                { className: "ui-hint" },
                "No spells match that search."
              )
            : null
        );

    const spellFilterControls =
      totalSpells === 0
        ? null
        : React.createElement(
            "div",
            { className: "sheet-spell-filters" },
            Field({
              label: "Show level",
              children: React.createElement(
                "select",
                {
                  className: "ui-select",
                  value: spellFilterLevel,
                  onChange: (e) => setSpellFilterLevel(e.target.value),
                },
                [
                  React.createElement(
                    "option",
                    { key: "all", value: "all" },
                    "All levels"
                  ),
                  ...spellLevelOptions.map((lvl) =>
                    React.createElement(
                      "option",
                      { key: lvl, value: String(lvl) },
                      levelLabel(lvl)
                    )
                  ),
                ]
              ),
            }),
            Field({
              label: "Prepared filter",
              children: React.createElement(
                "div",
                { className: "sheet-spell-filter-buttons" },
                preparedFilterOptions.map((opt) =>
                  React.createElement(
                    "button",
                    {
                      key: opt.id,
                      type: "button",
                      className: `sheet-spell-filter-btn ${
                        spellFilterPrepared === opt.id ? "active" : ""
                      }`,
                      onClick: () => setSpellFilterPrepared(opt.id),
                    },
                    opt.label
                  )
                )
              ),
            }),
            Field({
              label: "Search known spells",
              children: React.createElement("input", {
                className: "ui-input",
                value: spellListSearch,
                placeholder: "name, school, effect, note",
                onChange: (e) => setSpellListSearch(e.target.value),
              }),
            }),
            React.createElement(
              "div",
              { className: "sheet-spell-filter-summary" },
              `${filteredSpellCount}/${totalSpells} shown`,
              filtersActive
                ? React.createElement(
                    "button",
                    {
                      type: "button",
                      className: "sheet-spell-filter-reset",
                      onClick: resetSpellFilters,
                    },
                    "Reset filters"
                  )
                : null
            )
          );

    const spellStatsBar =
      spellStats.total === 0
        ? null
        : React.createElement(
            "div",
            {
              className: "sheet-spell-stats",
              style: {
                display: "grid",
                gridTemplateColumns: isCompact
                  ? "repeat(2, minmax(0, 1fr))"
                  : "repeat(4, minmax(0, 1fr))",
                gap: 12,
              },
            },
            [
              { label: "Known spells", value: spellStats.total },
              {
                label: "Prepared",
                value: `${spellStats.prepared}${
                  spellStats.total
                    ? ` (${spellStats.preparedPct}% )`
                    : ""
                }`,
              },
              { label: "Rituals", value: spellStats.rituals },
              { label: "Concentration", value: spellStats.concentration },
            ].map((stat) =>
              React.createElement(
                "div",
                {
                  key: stat.label,
                  className: "sheet-spell-stat",
                  style: {
                    border: "1px solid rgba(148,163,184,0.35)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    background: "rgba(15,23,42,0.4)",
                  },
                },
                React.createElement(
                  "div",
                  {
                    className: "sheet-spell-stat-value",
                    style: { fontSize: 20, fontWeight: 600 },
                  },
                  stat.value
                ),
                React.createElement(
                  "div",
                  {
                    className: "sheet-spell-stat-label",
                    style: { fontSize: 12, opacity: 0.75, marginTop: 4 },
                  },
                  stat.label
                )
              )
            )
          );

    const renderSpellEditor = (spell) => {
      const componentsText = Array.isArray(spell.components)
        ? spell.components.join(", ")
        : "";
      const isExpanded = isSpellEditorOpen(spell.id);
      const title = spell.name?.trim() || "Untitled spell";
      const subtitle = [
        levelLabel(Number(spell.level ?? 0)),
        spell.school,
        spell.prepared ? "Prepared" : null,
        spell.ritual ? "Ritual" : null,
        spell.concentration ? "Concentration" : null,
      ]
        .filter(Boolean)
        .join(" • ");
      const infoLine = [spell.range || "", spell.duration || ""]
        .map((val) => (val || "").trim())
        .filter(Boolean)
        .join(" • ");
      const noteLine = (spell.note || "").trim();

      const details = [
        Field({
          label: "Spell name",
          children: React.createElement("input", {
            className: "ui-input",
            value: spell.name,
            onChange: (e) => updateSpell(spell.id, { name: e.target.value }),
          }),
        }),
        Field({
          label: "Level",
          children: React.createElement(
            "select",
            {
              className: "ui-select",
              value: String(Number(spell.level ?? 0)),
              onChange: (e) =>
                updateSpell(spell.id, {
                  level: Math.min(
                    9,
                    Math.max(0, Number(e.target.value) || 0)
                  ),
                }),
            },
            Array.from({ length: 10 }, (_, lvl) =>
              React.createElement(
                "option",
                { key: lvl, value: String(lvl) },
                lvl === 0 ? "Cantrip (0)" : `Level ${lvl}`
              )
            )
          ),
        }),
        Field({
          label: "School",
          children: React.createElement(
            "select",
            {
              className: "ui-select",
              value: spell.school || "",
              onChange: (e) =>
                updateSpell(spell.id, { school: e.target.value }),
            },
            [
              React.createElement(
                "option",
                { key: "blank", value: "" },
                "Select school"
              ),
              ...SPELL_SCHOOLS.map((school) =>
                React.createElement(
                  "option",
                  { key: school, value: school },
                  school
                )
              ),
            ]
          ),
        }),
        Field({
          label: "Prepared",
          children: React.createElement(
            Btn,
            {
              type: "button",
              className: spell.prepared ? "tab-btn-active" : "",
              onClick: () =>
                updateSpell(spell.id, { prepared: !spell.prepared }),
            },
            spell.prepared ? "Prepared" : "Not prepared"
          ),
        }),
        Field({
          label: "Casting time",
          children: React.createElement("input", {
            className: "ui-input",
            value: spell.castingTime || "",
            placeholder: "1 action",
            onChange: (e) =>
              updateSpell(spell.id, { castingTime: e.target.value }),
          }),
        }),
        Field({
          label: "Range",
          children: React.createElement("input", {
            className: "ui-input",
            value: spell.range || "",
            placeholder: "60 feet",
            onChange: (e) => updateSpell(spell.id, { range: e.target.value }),
          }),
        }),
        Field({
          label: "Duration",
          children: React.createElement("input", {
            className: "ui-input",
            value: spell.duration || "",
            placeholder: "Instantaneous",
            onChange: (e) =>
              updateSpell(spell.id, { duration: e.target.value }),
          }),
        }),
        Field({
          label: "Components",
          hint: "Comma-separated (e.g., V, S, M)",
          children: React.createElement("input", {
            className: "ui-input",
            value: componentsText,
            onChange: (e) =>
              updateSpell(spell.id, {
                components: normalizeComponents(e.target.value),
              }),
          }),
        }),
        Field({
          label: "Materials",
          children: React.createElement("input", {
            className: "ui-input",
            value: spell.materials || "",
            placeholder: "a pinch of sulfur",
            onChange: (e) =>
              updateSpell(spell.id, { materials: e.target.value }),
          }),
        }),
        Field({
          label: "Flags",
          children: React.createElement(
            "div",
            { className: "sheet-spell-flag-buttons" },
            Btn({
              type: "button",
              className: spell.concentration ? "tab-btn-active" : "",
              onClick: () =>
                updateSpell(spell.id, {
                  concentration: !spell.concentration,
                }),
              children: spell.concentration ? "Concentration" : "No Concentration",
            }),
            Btn({
              type: "button",
              className: spell.ritual ? "tab-btn-active" : "",
              onClick: () =>
                updateSpell(spell.id, { ritual: !spell.ritual }),
              children: spell.ritual ? "Ritual" : "No Ritual",
            })
          ),
        }),
        Field({
          label: "Summary note",
          children: React.createElement("input", {
            className: "ui-input",
            value: spell.note || "",
            placeholder: "Quick reference summary",
            onChange: (e) => updateSpell(spell.id, { note: e.target.value }),
          }),
        }),
        Field({
          label: "Description",
          children: React.createElement("textarea", {
            className: "ui-input",
            style: { minHeight: 120, resize: "vertical" },
            value: spell.description || "",
            placeholder: "Paste or write the spell details here.",
            onChange: (e) =>
              updateSpell(spell.id, { description: e.target.value }),
          }),
        }),
        React.createElement(
          Btn,
          {
            type: "button",
            onClick: () => removeSpell(spell.id),
            className: "btn-muted",
          },
          "Remove spell"
        ),
      ];

      const quickActions = React.createElement(
        "div",
        { className: "sheet-spell-summary-actions" },
        React.createElement(
          Btn,
          {
            type: "button",
            className: spell.prepared ? "btn-primary" : "btn-muted",
            onClick: () => updateSpell(spell.id, { prepared: !spell.prepared }),
          },
          spell.prepared ? "Prepared" : "Mark prepared"
        ),
        React.createElement(
          Btn,
          {
            type: "button",
            className: "btn-muted",
            onClick: () => toggleSpellEditor(spell.id),
          },
          isExpanded ? "Hide details" : "Edit details"
        )
      );

      return React.createElement(
        "div",
        {
          key: spell.id,
          className: "sheet-spell-card",
        },
        React.createElement(
          "div",
          {
            className: "sheet-spell-card-summary",
            onClick: (e) => {
              if (
                e.target.closest("button") ||
                e.target.closest("input") ||
                e.target.closest("select")
              )
                return;
              toggleSpellEditor(spell.id);
            },
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 6,
            },
          },
          React.createElement(
            "div",
            { className: "sheet-spell-card-header" },
            React.createElement(
              "div",
              {
                className: "sheet-spell-card-title",
                style: { fontSize: 16, fontWeight: 600 },
              },
              title
            ),
            quickActions
          ),
          subtitle
            ? React.createElement(
                "div",
                {
                  className: "sheet-spell-card-subtitle",
                  style: { fontSize: 12, opacity: 0.75 },
                },
                subtitle
              )
            : null,
          infoLine
            ? React.createElement(
                "div",
                {
                  className: "sheet-spell-card-info-line",
                  style: { fontSize: 12, opacity: 0.6 },
                },
                infoLine
              )
            : null,
          noteLine
            ? React.createElement(
                "div",
                {
                  className: "sheet-spell-card-note",
                  style: { fontSize: 12, opacity: 0.75 },
                },
                noteLine
              )
            : null
        ),
        isExpanded
          ? React.createElement(
              "div",
              {
                className: "sheet-spell-card-details",
                style: { display: "grid", gap: 12 },
              },
              details
            )
          : null
      );
    };

    const spellsTab = Card({
      children: React.createElement(
        "div",
        { className: "grid gap-3" },
        spellCatalogSection,
        spellStatsBar,
        totalSpells === 0
          ? React.createElement(
              "div",
              { className: "ui-hint" },
              "No spells recorded yet. Use the catalog above or add them manually."
            )
          : React.createElement(
              React.Fragment,
              null,
              spellFilterControls,
              groupedSpells.length === 0
                ? React.createElement(
                    "div",
                    { className: "ui-hint" },
                    "No spells match the current filters."
                  )
                : groupedSpells.map(([level, spells]) => {
                    const stats =
                      spellLevelStats.get(level) || {
                        total: spells.length,
                        prepared: spells.filter((sp) => sp.prepared).length,
                      };
                    const collapsed = isLevelCollapsed(level);
                    return React.createElement(
                      "div",
                      {
                        key: level,
                        className: ["sheet-spell-group", collapsed ? "collapsed" : ""]
                          .filter(Boolean)
                          .join(" "),
                      },
                      React.createElement(
                        "div",
                        { className: "sheet-spell-group-header" },
                        React.createElement(
                          "div",
                          { className: "sheet-spell-group-title" },
                          levelLabel(level)
                        ),
                        React.createElement(
                          "div",
                          { className: "sheet-spell-group-meta" },
                          `${stats.prepared}/${stats.total} prepared`
                        ),
                        React.createElement(
                          "div",
                          { className: "sheet-spell-group-actions" },
                          React.createElement(
                            Btn,
                            {
                              type: "button",
                              className: "btn-muted",
                              onClick: () => toggleSpellLevelCollapse(level),
                            },
                            collapsed ? "Expand" : "Collapse"
                          ),
                          stats.prepared < stats.total
                            ? React.createElement(
                                Btn,
                                {
                                  type: "button",
                                  className: "btn-primary",
                                  onClick: () => setPreparedForLevel(level, true),
                                },
                                "Prepare all"
                              )
                            : null,
                          stats.prepared > 0
                            ? React.createElement(
                                Btn,
                                {
                                  type: "button",
                                  className: "btn-muted",
                                  onClick: () => setPreparedForLevel(level, false),
                                },
                                "Clear prepared"
                              )
                            : null
                        )
                      ),
                      collapsed
                        ? React.createElement(
                            "div",
                            {
                              className: "sheet-spell-group-collapsed-hint",
                              style: {
                                fontSize: 12,
                                opacity: 0.7,
                                padding: "0 4px 8px",
                              },
                            },
                            `${spells.length} spell${
                              spells.length === 1 ? "" : "s"
                            } hidden`
                          )
                        : React.createElement(
                            "div",
                            { className: "sheet-spell-group-body" },
                            spells.map((spell) => renderSpellEditor(spell))
                          )
                    );
                  })
            ),
        React.createElement(
          Btn,
          { type: "button", onClick: addSpell },
          "+ Add spell"
        )
      ),
    });

    const notesTab = Card({
      children: Field({
        label: "Campaign notes",
        children: React.createElement("textarea", {
          className: "ui-input",
          style: { minHeight: 180, resize: "vertical" },
          value: sheet.notes || "",
          placeholder: "Backstory, session notes, bonds...",
          onChange: (e) =>
            updateSheet((prev) => ({ ...prev, notes: e.target.value })),
        }),
      }),
    });

    const tabs = [
      { id: "overview", label: "Overview", node: overviewTab },
      { id: "abilities", label: "Abilities", node: abilitiesTab },
      {
        id: "skills",
        label: "Skills",
        node: skillsTab,
        badge: proficientCount ? String(proficientCount) : null,
      },
      {
        id: "inventory",
        label: "Inventory",
        node: inventoryTab,
        badge: inventoryCount ? String(inventoryCount) : null,
      },
      {
        id: "spells",
        label: "Spells",
        node: spellsTab,
        badge: sheet.spells.length
          ? `${preparedCount}/${sheet.spells.length}`
          : null,
      },
      {
        id: "notes",
        label: "Notes",
        node: notesTab,
        badge: notesPresent ? "!" : null,
      },
    ];

    const activeContent =
      tabs.find((tab) => tab.id === activeTab)?.node || overviewTab;

    const tabNav = isCompact
      ? Card({
          className: "sheet-tab-picker",
          children: Field({
            label: "Jump to section",
            children: React.createElement(
              "select",
              {
                className: "ui-select",
                value: activeTab,
                onChange: (e) => setActiveTab(e.target.value),
              },
              tabs.map((tab) =>
                React.createElement(
                  "option",
                  { key: tab.id, value: tab.id },
                  tab.badge ? `${tab.label} (${tab.badge})` : tab.label
                )
              )
            ),
          }),
        })
      : React.createElement(
          "div",
          { className: "tab-bar sheet-tab-scroll" },
          tabs.map((tab) =>
            React.createElement(
              "button",
              {
                key: tab.id,
                className: `tab-btn px-4 py-2 ${
                  activeTab === tab.id ? "tab-btn-active" : ""
                }`,
                onClick: () => setActiveTab(tab.id),
              },
              [
                tab.label,
                tab.badge
                  ? React.createElement(
                      "span",
                      { className: "tab-badge" },
                      tab.badge
                    )
                  : null,
              ]
            )
          )
        );

    return React.createElement(
      "div",
      { className: "grid gap-4" },
      heroCard,
      actionBar,
      errorBanner,
      tabNav,
      activeContent
    );
  }

  AppNS.SheetPage = SheetPage;
})();
