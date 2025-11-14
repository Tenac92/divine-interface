(function () {
  const AppNS = (window.App = window.App || {});
  const { useEffect, useMemo, useState, useRef, useCallback } = React;

  if (!AppNS.SheetConstants || !AppNS.SheetServices) {
    console.error(
      "[Sheet] Missing dependencies. Ensure sheet.constants.js and sheet.services.js are loaded first."
    );
    return;
  }

  const {
    ABILITIES,
    SKILLS,
    SKILL_ABILITY_MAP,
    SPELL_SCHOOLS,
    DEFAULT_CLASS_OPTIONS,
    DEFAULT_SPECIES_OPTIONS,
  } = AppNS.SheetConstants;

  const {
    HAS_SUPABASE,
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
  } = AppNS.SheetServices;

  const SheetSelectors = AppNS.SheetSelectors || {};
  const HooksAPI = AppNS.SheetHooks || {};
  const SheetComponents = AppNS.SheetComponents || {};
  const OverviewComponent = SheetComponents.Overview;
  const CombatComponent = SheetComponents.Combat;
  const AbilitiesComponent = SheetComponents.Abilities;
  const SkillsComponent = SheetComponents.Skills;
  const InventoryComponent = SheetComponents.Inventory;
  const SpellsComponent = SheetComponents.Spells;
  const NotesComponent = SheetComponents.Notes;
  const AUTOSAVE_DELAY_MS = 2500;
  const MOBILE_NUMBER_PROPS = {
    inputMode: "numeric",
    pattern: "[0-9]*",
  };
  const WEAPON_NAME_PATTERN =
    /(sword|axe|bow|dagger|mace|spear|staff|hammer|crossbow|blade|whip|club|flail|halberd|pike|glaive|glive|polearm|lance|trident)/i;

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
  const Field = ({
    label,
    hint,
    children,
    labelAlign,
    labelClassName = "",
    labelStyle = null,
  }) => {
    const combinedLabelClass = ["ui-label", labelClassName]
      .filter(Boolean)
      .join(" ");
    const combinedLabelStyle = labelAlign
      ? { ...(labelStyle || {}), textAlign: labelAlign }
      : labelStyle;
    return React.createElement(
      "label",
      { className: "ui-field" },
      label
        ? React.createElement(
            "span",
            { className: combinedLabelClass, style: combinedLabelStyle || undefined },
            label
          )
        : null,
      children,
      hint
        ? React.createElement("span", { className: "ui-hint" }, hint)
        : null
    );
  };



  // ---------- Component ----------
  function SheetPage(props) {
    const {
      initialTab = "overview",
      lockedTab = null,
      hideTabs = false,
    } = props || {};
    const initialTabId = lockedTab || initialTab || "overview";
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
    const [activeTab, setActiveTab] = useState(initialTabId);
    const [errors, setErrors] = useState([]);
    const [isCompact, setIsCompact] = useState(() => {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return window.matchMedia("(max-width: 768px)").matches;
    });
    const [restDialog, setRestDialog] = useState(null);
    const catalog = AppNS.Catalog || {};
    const hasClassCatalog = typeof catalog.listClasses === "function";
    const hasSpeciesCatalog = typeof catalog.listSpecies === "function";
    const hasWeaponCatalog = typeof catalog.listWeapons === "function";
    const hasSpellCatalog = typeof catalog.listSpells === "function";
    const hasGearCatalog = hasWeaponCatalog || HAS_SUPABASE;
    const useClassCatalogHook =
      HooksAPI.useClassCatalog ||
      function useClassCatalogFallback({ initial }) {
        return initial;
      };
    const useSpeciesCatalogHook =
      HooksAPI.useSpeciesCatalog ||
      function useSpeciesCatalogFallback({ initial }) {
        return initial;
      };
    const useStoreItemsHook =
      HooksAPI.useStoreItems ||
      function useStoreItemsFallback() {
        return [];
      };
    const useWeaponCatalogHook =
      HooksAPI.useWeaponCatalog ||
      function useWeaponCatalogFallback() {
        return { results: [], loading: false };
      };
    const useSpellCatalogHook =
      HooksAPI.useSpellCatalog ||
      function useSpellCatalogFallback() {
        return { results: [], loading: false };
      };

    const classOptions = useClassCatalogHook({
      catalog,
      hasClassCatalog,
      initial: DEFAULT_CLASS_OPTIONS,
    });
    const speciesOptions = useSpeciesCatalogHook({
      catalog,
      hasSpeciesCatalog,
      initial: DEFAULT_SPECIES_OPTIONS,
    });
    const [gearSearch, setGearSearch] = useState("");
    const [skillSearch, setSkillSearch] = useState("");
    const [showHeroEditor, setShowHeroEditor] = useState(false);
    const storeItems = useStoreItemsHook({
      enabled: HAS_SUPABASE,
      fetchFaithItems,
    });
    const [spellSearch, setSpellSearch] = useState("");
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
    const autosaveTimerRef = useRef(null);
    useEffect(() => {
      if (lockedTab) {
        setActiveTab(lockedTab);
      }
    }, [lockedTab]);

    const { results: weaponResults, loading: weaponLoading } =
      useWeaponCatalogHook({
        catalog,
        hasWeaponCatalog,
        gearSearch,
      });
    const { results: spellResults, loading: spellLoading } = useSpellCatalogHook({
      catalog,
      hasSpellCatalog,
      spellSearch,
      spellCatalogClass,
      spellCatalogLevel,
      spellCatalogSchool,
      spellCatalogRitual,
      spellCatalogConcentration,
      sheetClassName: sheet.className,
    });

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


    const updateSheet = (producer) => {
      setSheet((prev) => {
        const next = producer(prev);
        setDirty(true);
        return next;
      });
    };

    const isBlankNumericInput = (val) =>
      val === "" || val === null || typeof val === "undefined";

    const handleAcChange = (value) => {
      updateSheet((prev) => {
        if (isBlankNumericInput(value)) {
          return { ...prev, ac: "" };
        }
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
          return prev;
        }
        return {
          ...prev,
          ac: Math.max(1, numeric),
        };
      });
    };

    const handleHpFieldChange = (field, value) => {
      updateSheet((prev) => {
        const prevHp = prev.hp || {};
        if (isBlankNumericInput(value)) {
          return {
            ...prev,
            hp: {
              ...prevHp,
              [field]: "",
            },
          };
        }
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
          return prev;
        }
        const nextValue =
          field === "max" ? Math.max(1, numeric) : Math.max(0, numeric);
        return {
          ...prev,
          hp: {
            ...prevHp,
            [field]: nextValue,
          },
        };
      });
    };

    const getNumericHp = (value, fallback = 0) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    };

    const applyShortRest = (recovered) => {
      if (!Number.isFinite(recovered) || recovered <= 0) {
        AppNS.toast &&
          AppNS.toast("Enter a positive HP amount to recover.");
        return;
      }
      updateSheet((prev) => {
        const hp = prev.hp || {};
        const rawMax = getNumericHp(hp.max, null);
        const cap = rawMax == null ? null : Math.max(0, rawMax);
        const current = Math.max(0, getNumericHp(hp.current));
        const nextCurrent =
          cap == null ? current + recovered : Math.min(cap, current + recovered);
        return {
          ...prev,
          hp: {
            ...hp,
            current: nextCurrent,
          },
        };
      });
      AppNS.toast && AppNS.toast("Short rest applied.");
    };

    const applyLongRest = () => {
      updateSheet((prev) => {
        const hp = prev.hp || {};
        const rawMax = getNumericHp(hp.max, null);
        const fallbackCurrent = Math.max(0, getNumericHp(hp.current));
        const nextCurrent =
          rawMax == null ? fallbackCurrent : Math.max(0, rawMax);
        return {
          ...prev,
          hp: {
            ...hp,
            current: nextCurrent,
            temp: 0,
          },
        };
      });
      AppNS.toast && AppNS.toast("Long rest applied.");
    };

    const openShortRestDialog = () =>
      setRestDialog({ type: "short", amount: "" });
    const openLongRestDialog = () => setRestDialog({ type: "long" });
    const closeRestDialog = () => setRestDialog(null);

    const submitShortRest = () => {
      if (restDialog?.type !== "short") return;
      const recovered = Number(restDialog.amount);
      if (!Number.isFinite(recovered) || recovered <= 0) {
        AppNS.toast &&
          AppNS.toast("Enter a positive HP amount to recover.");
        return;
      }
      applyShortRest(recovered);
      closeRestDialog();
    };

    const submitLongRest = () => {
      if (restDialog?.type !== "long") return;
      applyLongRest();
      closeRestDialog();
    };

    const saveChanges = useCallback(
      async (options = {}) => {
        if (!profile) return;
        const { silent = false } = options;
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
          if (!silent) {
            AppNS.toast && AppNS.toast("Sheet saved.");
          }
        } catch (err) {
          console.error("[Sheet] save failed", err);
          const message = silent
            ? "Autosave failed. Please save manually."
            : "Saving failed. Try again.";
          AppNS.toast && AppNS.toast(message);
        } finally {
          setSaving(false);
        }
      },
      [profile, sheet, session.username]
    );

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
      if (SheetSelectors.selectAbilityMods) {
        return SheetSelectors.selectAbilityMods(sheet.abilities);
      }
      const mods = {};
      ABILITIES.forEach(({ key }) => {
        mods[key] = abilityMod(sheet.abilities?.[key] ?? 10);
      });
      return mods;
    }, [sheet.abilities]);

    const handleAbilityChange = (key, value) =>
      updateSheet((prev) => ({
        ...prev,
        abilities: {
          ...prev.abilities,
          [key]: Number(value) || 0,
        },
      }));

    const spellSlots = useMemo(
      () =>
        SheetSelectors.selectSpellSlots
          ? SheetSelectors.selectSpellSlots(sheet.spellSlots)
          : normalizeSpellSlots(sheet.spellSlots),
      [sheet.spellSlots]
    );

    const getSkillAbilityKey = (skill) =>
      SKILL_ABILITY_MAP[skill.ability] || skill.ability?.toLowerCase?.() || "dex";

    const getSkillBonus = (skill) => {
      if (!skill) return 0;
      const abilityKey = getSkillAbilityKey(skill);
      const base = abilityMods[abilityKey] || 0;
      const trained = !!sheet.skills?.[skill.key];
      return base + (trained ? proficiency : 0);
    };

    const formatBonus = (value) => (value >= 0 ? `+${value}` : `${value}`);

    const filteredSkillList = useMemo(() => {
      if (SheetSelectors.selectFilteredSkills) {
        return SheetSelectors.selectFilteredSkills(skillSearch);
      }
      const terms = skillSearch
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      if (!terms.length) return SKILLS;
      return SKILLS.filter((skill) => {
        const haystack = [skill.label, skill.ability]
          .map((val) => (val || "").toLowerCase())
          .join(" ");
        return terms.every((term) => haystack.includes(term));
      });
    }, [skillSearch]);

    const skillsByAbility = useMemo(() => {
      if (SheetSelectors.selectSkillsByAbility) {
        return SheetSelectors.selectSkillsByAbility(filteredSkillList);
      }
      const map = new Map();
      filteredSkillList.forEach((skill) => {
        const abilityKey = getSkillAbilityKey(skill);
        if (!map.has(abilityKey)) map.set(abilityKey, []);
        map.get(abilityKey).push(skill);
      });
      return map;
    }, [filteredSkillList]);

    const passiveScore = (skillKey) => {
      const skill = SKILLS.find((s) => s.key === skillKey);
      if (!skill) return null;
      return 10 + getSkillBonus(skill);
    };

    const skillSummary = useMemo(() => {
      if (SheetSelectors.selectSkillSummary) {
        return SheetSelectors.selectSkillSummary(sheet, abilityMods, proficiency);
      }
      const best = SKILLS.reduce(
        (acc, skill) => {
          const bonus = getSkillBonus(skill);
          if (!acc || bonus > acc.bonus) return { skill, bonus };
          return acc;
        },
        null
      );
      return {
        proficientCount: Object.values(sheet.skills || {}).filter(Boolean).length,
        bestSkill: best,
        passivePerception: passiveScore("perception"),
        passiveInvestigation: passiveScore("investigation"),
        passiveInsight: passiveScore("insight"),
      };
    }, [sheet.skills, abilityMods, proficiency]);


    const xpCeil = xpForLevel(Math.min((sheet.level || 1) + 1, 20));
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
    const preparedSpells = useMemo(
      () =>
        SheetSelectors.selectPreparedSpells
          ? SheetSelectors.selectPreparedSpells(sortedSpells)
          : sortedSpells.filter((spell) => spell.prepared),
      [sortedSpells]
    );
    const preparedSpellsByLevel = useMemo(
      () =>
        SheetSelectors.selectPreparedSpellsByLevel
          ? SheetSelectors.selectPreparedSpellsByLevel(preparedSpells)
          : (() => {
              const map = new Map();
              preparedSpells.forEach((spell) => {
                const lvl = Number(spell.level ?? 0);
                const key = Number.isFinite(lvl)
                  ? Math.max(0, Math.min(9, lvl))
                  : 0;
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(spell);
              });
              return map;
            })(),
      [preparedSpells]
    );
    const knownSpellNames = useMemo(
      () =>
        new Set(
          (sheet.spells || []).map((spell) =>
            (spell.name || "").toLowerCase()
          )
        ),
      [sheet.spells]
    );
    const inventoryHighlights = useMemo(
      () =>
        SheetSelectors.selectInventoryHighlights
          ? SheetSelectors.selectInventoryHighlights(sheet.inventory, 4)
          : (Array.isArray(sheet.inventory) ? sheet.inventory : []).slice(0, 4),
      [sheet.inventory]
    );
    const notesPreview = useMemo(
      () =>
        SheetSelectors.selectNotesPreview
          ? SheetSelectors.selectNotesPreview(sheet.notes)
          : (sheet.notes || "").trim(),
      [sheet.notes]
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
    const weaponItems = useMemo(() => {
      const list = Array.isArray(sheet.inventory) ? sheet.inventory : [];
      return list.filter((item) => {
        const name = item?.name || "";
        const note = (item?.note || "").toLowerCase();
        return WEAPON_NAME_PATTERN.test(name) || note.includes("damage");
      });
    }, [sheet.inventory]);
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

    const updateSpellSlot = (level, patch) =>
      updateSheet((prev) => {
        const slots = normalizeSpellSlots(prev.spellSlots);
        const target = slots[level] || { total: 0, used: 0 };
        const next = { ...target, ...patch };
        next.total = Math.max(0, Number(next.total) || 0);
        next.used = Math.max(0, Math.min(Number(next.used) || 0, next.total));
        slots[level] = next;
        return { ...prev, spellSlots: slots };
      });

    const setSpellSlotTotal = (level, total) => {
      const numeric = Math.max(0, Number(total) || 0);
      updateSpellSlot(level, { total: numeric });
    };

    const spendSpellSlot = (level) => {
      const slot = spellSlots[level];
      if (!slot) return;
      if (level === 0) {
        AppNS.toast && AppNS.toast("Cantrips do not require spell slots.");
        return;
      }
      if (slot.total <= 0) {
        AppNS.toast &&
          AppNS.toast(`Set slots for ${levelLabel(level)} before tracking usage.`);
        return;
      }
      if (slot.used >= slot.total) {
        AppNS.toast && AppNS.toast("All slots for this level are already spent.");
        return;
      }
      updateSpellSlot(level, { used: slot.used + 1 });
    };

    const refundSpellSlot = (level) => {
      const slot = spellSlots[level];
      if (!slot || slot.used <= 0) return;
      updateSpellSlot(level, { used: slot.used - 1 });
    };

    const resetSpellSlotUsage = (level) => updateSpellSlot(level, { used: 0 });

    const handlePreparedSpellClick = (spell) => {
      const lvl = Number(spell.level ?? 0);
      const level = Number.isFinite(lvl) ? Math.max(0, Math.min(9, lvl)) : 0;
      spendSpellSlot(level);
    };

    const canSave = dirty && !saving && errors.length === 0;

    useEffect(() => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (!profile || !canSave) return undefined;
      const handle = setTimeout(() => {
        autosaveTimerRef.current = null;
        saveChanges({ silent: true });
      }, AUTOSAVE_DELAY_MS);
      autosaveTimerRef.current = handle;
      return () => {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
      };
    }, [profile, canSave, saveChanges]);

    if (loading) {
      return React.createElement(
        "div",
        { className: "card max-w-lg mx-auto" },
        "Loading character sheet..."
      );
    }

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

    const preparedSpellLevels = Array.from(
      new Set([
        ...preparedSpellsByLevel.keys(),
        ...spellSlots
          .map((slot, lvl) => ({ lvl, slot }))
          .filter(({ slot }) => slot.total > 0)
          .map(({ lvl }) => lvl),
      ])
    ).filter((lvl) => lvl >= 0 && lvl <= 9);
    const overviewTab = OverviewComponent
      ? React.createElement(OverviewComponent, {
          Card,
          gridCols,
          ABILITIES,
          formatBonus,
          sheet,
          xpCeil,
          abilityMods,
          skillSummary,
          inventoryHighlights,
          inventoryCount,
          notesPreview,
        })
      : Card({
          children: React.createElement(
            "div",
            { className: "ui-hint" },
            "Overview unavailable"
          ),
        });
    const heroChipData = [
      { label: "Class", value: sheet.className || "Unset" },
      { label: "Species", value: sheet.species || "Unset" },
      { label: "Background", value: sheet.background || "Unset" },
      {
        label: "Inspiration",
        value: sheet.inspiration ? "Inspired" : "Not inspired",
      },
      { label: "Proficiency", value: `+${proficiency}` },
    ];
    const autosaveStatus = savedAtLabel
      ? React.createElement(
          "div",
          {
            className: "ui-hint",
            style: { textAlign: "right" },
          },
          savedAtLabel
        )
      : null;

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
          ),
          Btn({
            type: "button",
            className: "btn-muted",
            onClick: () => setShowHeroEditor((prev) => !prev),
            children: showHeroEditor ? "Hide editor" : "Edit basics",
          })
        ),
        React.createElement(
          "div",
          { className: "sheet-hero-summary" },
          heroChipData.map((chip) =>
            React.createElement(
              "div",
              { key: chip.label, className: "sheet-hero-chip" },
              React.createElement("span", { className: "chip-label" }, chip.label),
              React.createElement("strong", null, chip.value)
            )
          )
        ),
        showHeroEditor
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement(
                "div",
                {
                  className: "sheet-hero-grid",
                  style: {
                    gridTemplateColumns: gridCols(
                      "repeat(auto-fit, minmax(150px, 1fr))"
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
                  className: "sheet-hero-grid",
                  style: {
                    gridTemplateColumns: gridCols(
                      "repeat(auto-fit, minmax(150px, 1fr))"
                    ),
                  },
                },
                Field({
                  label: "Level",
                  hint: "Adjusting level updates proficiency",
                  children: React.createElement(
                    "input",
                    Object.assign(
                      {
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
                      },
                      MOBILE_NUMBER_PROPS
                    )
                  ),
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
              )
            )
          : null
      ),
    });    const combatTab = CombatComponent
      ? React.createElement(CombatComponent, {
          Card,
          Field,
          Btn,
          gridCols,
          sheet,
          abilityMods,
          proficiency,
          onAcChange: handleAcChange,
          onHpChange: handleHpFieldChange,
          preparedSpellLevels,
          preparedSpellsByLevel,
          spellSlots,
          levelLabel,
          onSpellSlotTotalChange: setSpellSlotTotal,
          onRefundSpellSlot: refundSpellSlot,
          onResetSpellSlot: resetSpellSlotUsage,
          onPreparedSpellClick: handlePreparedSpellClick,
          weaponItems,
          onShortRest: openShortRestDialog,
          onLongRest: openLongRestDialog,
        })
      : Card({
          children: React.createElement(
            "div",
            { className: "ui-hint" },
            "Combat view unavailable"
          ),
        });

    const abilitiesTab = AbilitiesComponent
      ? React.createElement(AbilitiesComponent, {
          Card,
          gridCols,
          ABILITIES,
          abilities: sheet.abilities,
          abilityMods,
          onAbilityChange: handleAbilityChange,
        })
      : Card({
          children: React.createElement(
            "div",
            { className: "ui-hint" },
            "Abilities view unavailable"
          ),
        });

    const renderSkillRow = (skill) => {
      const trained = !!sheet.skills?.[skill.key];
      const bonus = getSkillBonus(skill);
      return React.createElement(
        "button",
        {
          key: skill.key,
          type: "button",
          className: ["sheet-skill-row", trained ? "tab-btn-active" : ""]
            .filter(Boolean)
            .join(" "),
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            padding: "0.5rem 0.75rem",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            background: trained ? "rgba(34,197,94,0.15)" : "transparent",
          },
          onClick: () => toggleSkill(skill.key),
        },
        React.createElement(
          "div",
          { style: { textAlign: "left" } },
          React.createElement(
            "div",
            { style: { fontWeight: 600 } },
            skill.label
          ),
          React.createElement(
            "div",
            { className: "ui-hint", style: { textTransform: "none" } },
            `${skill.ability} ability`
          )
        ),
        React.createElement(
          "div",
          { style: { textAlign: "right" } },
          React.createElement(
            "div",
            { style: { fontWeight: 600, fontVariantNumeric: "tabular-nums" } },
            formatBonus(bonus)
          ),
          React.createElement(
            "div",
            { className: "ui-hint", style: { textTransform: "none" } },
            trained ? "Proficient" : "Tap to train"
          )
        )
      );
    };

    const skillSearchField = Field({
      label: "Filter skills",
      hint: "Tap a skill to toggle proficiency",
      children: React.createElement("input", {
        className: "ui-input",
        placeholder: "Search Acrobatics, Dex, ...",
        value: skillSearch,
        onChange: (e) => setSkillSearch(e.target.value),
      }),
    });


    const skillsTab = SkillsComponent
      ? React.createElement(SkillsComponent, {
          Card,
          skillSearchField,
          skillSummary,
          gridCols,
          ABILITIES,
          abilityMods,
          skillsByAbility,
          renderSkillRow,
          formatBonus,
        })
      : Card({
          children: React.createElement(
            "div",
            { className: "ui-hint" },
            "Skills view unavailable"
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

    const inventoryTab = InventoryComponent
      ? React.createElement(InventoryComponent, {
          Card,
          Field,
          Btn,
          gearCatalogSection,
          inventory: sheet.inventory,
          addInventoryItem,
          updateInventoryItem,
          removeInventoryItem,
        })
      : Card({
          children: React.createElement(
            "div",
            { className: "ui-hint" },
            "Inventory view unavailable"
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
        .join(" \u2022 ");
      const infoLine = [spell.range || "", spell.duration || ""]
        .map((val) => (val || "").trim())
        .filter(Boolean)
        .join(" \u2022 ");
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
        Btn({
          type: "button",
          className: spell.prepared ? "btn-primary" : "btn-muted",
          onClick: () => updateSpell(spell.id, { prepared: !spell.prepared }),
          children: spell.prepared ? "Prepared" : "Mark prepared",
        }),
        Btn({
          type: "button",
          className: "btn-muted",
          onClick: () => toggleSpellEditor(spell.id),
          children: isExpanded ? "Hide details" : "Edit details",
        })
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

    const spellsTab = SpellsComponent
      ? React.createElement(SpellsComponent, {
          Card,
          Btn,
          spellCatalogSection,
          spellStatsBar,
          totalSpells,
          spellFilterControls,
          groupedSpells,
          spellLevelStats,
          toggleSpellLevelCollapse,
          isLevelCollapsed,
          setPreparedForLevel,
          renderSpellEditor,
          addSpell,
          levelLabel,
        })
      : Card({
          children: React.createElement(
            "div",
            { className: "ui-hint" },
            "Spells view unavailable"
          ),
        });

    const notesTab = NotesComponent
      ? React.createElement(NotesComponent, {
          Card,
          Field,
          notes: sheet.notes,
          onChange: (value) =>
            updateSheet((prev) => ({
              ...prev,
              notes: value,
            })),
        })
      : Card({
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

    const baseTabs = [
      { id: "overview", label: "Overview", node: overviewTab },
      { id: "combat", label: "Combat", node: combatTab },
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

    const tabPool =
      lockedTab === "combat"
        ? baseTabs
        : baseTabs.filter((tab) => tab.id !== "combat");

    const visibleTabs = lockedTab
      ? tabPool.filter((tab) => tab.id === lockedTab)
      : tabPool;
    const resolvedTabId = lockedTab || activeTab;
    const activeContent =
      tabPool.find((tab) => tab.id === resolvedTabId)?.node || overviewTab;
    const showTabNav = !hideTabs && visibleTabs.length > 1;

    const handleTabChange = (next) => {
      if (lockedTab || next === activeTab) return;
      setActiveTab(next);
    };

    const tabNav = !showTabNav
      ? null
      : isCompact
      ? Card({
          className: "sheet-tab-picker",
          children: Field({
            label: "Jump to section",
            children: React.createElement(
              "select",
              {
                className: "ui-select",
                value: resolvedTabId,
                onChange: (e) => handleTabChange(e.target.value),
              },
              visibleTabs.map((tab) =>
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
          visibleTabs.map((tab) =>
            React.createElement(
              "button",
              {
                key: tab.id,
                className: `tab-btn px-4 py-2 ${
                  resolvedTabId === tab.id ? "tab-btn-active" : ""
                }`,
                onClick: () => handleTabChange(tab.id),
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

    const restDialogContent = !restDialog
      ? null
      : restDialog.type === "short"
      ? React.createElement(
          "div",
          { className: "grid gap-4" },
          React.createElement(
            "div",
            {
              style: {
                fontWeight: 600,
                fontSize: "1.15rem",
                textAlign: "center",
              },
            },
            "Short Rest"
          ),
          React.createElement(
            "p",
            {
              className: "ui-hint",
              style: { textAlign: "center", textTransform: "none" },
            },
            "Enter how many hit points were recovered during the short rest."
          ),
          Field({
            label: "HP Restored",
            labelAlign: "center",
            children: React.createElement(
              "input",
              Object.assign(
                {
                  className: "ui-input",
                  type: "text",
                  value: restDialog?.amount ?? "",
                  onChange: (e) =>
                    setRestDialog((prev) =>
                      prev?.type === "short"
                        ? { ...prev, amount: e.target.value }
                        : prev
                    ),
                  placeholder: "e.g. 7",
                  style: { textAlign: "center" },
                  onKeyDown: (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitShortRest();
                    }
                  },
                },
                MOBILE_NUMBER_PROPS
              )
            ),
          }),
          React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              },
            },
            React.createElement(
              Btn,
              {
                type: "button",
                className: "btn-primary",
                onClick: submitShortRest,
              },
              "Apply"
            ),
            React.createElement(
              Btn,
              {
                type: "button",
                className: "btn-muted",
                onClick: closeRestDialog,
              },
              "Cancel"
            )
          )
        )
      : React.createElement(
          "div",
          { className: "grid gap-4" },
          React.createElement(
            "div",
            {
              style: {
                fontWeight: 600,
                fontSize: "1.15rem",
                textAlign: "center",
              },
            },
            "Long Rest"
          ),
          React.createElement(
            "p",
            {
              className: "ui-hint",
              style: { textAlign: "center", textTransform: "none" },
            },
            "Restore current HP to its maximum value and clear any temporary HP."
          ),
          React.createElement(
            "p",
            {
              className: "ui-hint",
              style: {
                textAlign: "center",
                textTransform: "none",
                fontSize: "0.85rem",
              },
            },
            "Spell slots and other resources are not adjusted automatically."
          ),
          React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              },
            },
            React.createElement(
              Btn,
              {
                type: "button",
                className: "btn-primary",
                onClick: submitLongRest,
              },
              "Confirm"
            ),
            React.createElement(
              Btn,
              {
                type: "button",
                className: "btn-muted",
                onClick: closeRestDialog,
              },
              "Cancel"
            )
          )
        );

    const restDialogNode = !restDialog
      ? null
      : React.createElement(
          "div",
          {
            style: {
              position: "fixed",
              inset: 0,
              background: "rgba(2, 6, 23, 0.65)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.5rem",
              zIndex: 1000,
            },
            onClick: (event) => {
              if (event.target === event.currentTarget) {
                closeRestDialog();
              }
            },
          },
          Card({
            style: { maxWidth: 360, width: "100%" },
            children: restDialogContent,
          })
        );

    return React.createElement(
      React.Fragment,
      null,
      restDialogNode,
      React.createElement(
        "div",
        { className: "grid gap-4" },
        heroCard,
        errorBanner,
        autosaveStatus,
        tabNav,
        activeContent
      )
    );
  }

  function CombatPage(props) {
    return React.createElement(
      SheetPage,
      Object.assign({}, props, {
        initialTab: "combat",
        lockedTab: "combat",
        hideTabs: true,
      })
    );
  }

  AppNS.SheetPage = SheetPage;
  AppNS.CombatPage = CombatPage;
})();






