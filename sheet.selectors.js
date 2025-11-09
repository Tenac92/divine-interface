(function () {
  const AppNS = (window.App = window.App || {});
  const Constants = AppNS.SheetConstants || {};
  const Services = AppNS.SheetServices || {};
  const Selectors = (AppNS.SheetSelectors = AppNS.SheetSelectors || {});

  const ABILITIES = Constants.ABILITIES || [];
  const SKILLS = Constants.SKILLS || [];
  const SKILL_ABILITY_MAP = Constants.SKILL_ABILITY_MAP || {};
  const abilityMod = Services.abilityMod || ((score) => Math.floor((Number(score || 0) - 10) / 2));
  const normalizeSpellSlots = Services.normalizeSpellSlots || ((slots) => slots || []);

  function getSkillAbilityKey(skill) {
    if (!skill) return "dex";
    return (
      SKILL_ABILITY_MAP[skill.ability] ||
      (typeof skill.ability === "string" ? skill.ability.toLowerCase() : "dex")
    );
  }

  Selectors.selectAbilityMods = function selectAbilityMods(abilities = {}) {
    const mods = {};
    ABILITIES.forEach(({ key }) => {
      mods[key] = abilityMod(abilities?.[key] ?? 10);
    });
    return mods;
  };

  Selectors.selectSpellSlots = function selectSpellSlots(value) {
    return normalizeSpellSlots(value);
  };

  Selectors.selectFilteredSkills = function selectFilteredSkills(search = "") {
    const terms = String(search)
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
  };

  Selectors.selectSkillsByAbility = function selectSkillsByAbility(filtered) {
    const list = Array.isArray(filtered) ? filtered : [];
    const map = new Map();
    list.forEach((skill) => {
      const key = getSkillAbilityKey(skill);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(skill);
    });
    return map;
  };

  Selectors.selectSkillSummary = function selectSkillSummary(sheet, abilityMods, proficiency) {
    const summary = {
      proficientCount: Object.values(sheet?.skills || {}).filter(Boolean).length,
      bestSkill: null,
      passivePerception: null,
      passiveInvestigation: null,
      passiveInsight: null,
    };
    const getBonus = (skill) => {
      const abilityKey = getSkillAbilityKey(skill);
      const base = abilityMods?.[abilityKey] || 0;
      const trained = !!sheet?.skills?.[skill.key];
      return base + (trained ? proficiency : 0);
    };
    SKILLS.forEach((skill) => {
      const bonus = getBonus(skill);
      if (!summary.bestSkill || bonus > summary.bestSkill.bonus) {
        summary.bestSkill = { skill, bonus };
      }
    });
    const passiveBase = 10;
    const findSkill = (key) => SKILLS.find((s) => s.key === key);
    const setPassive = (prop, skillKey) => {
      const skill = findSkill(skillKey);
      summary[prop] = skill ? passiveBase + getBonus(skill) : null;
    };
    setPassive("passivePerception", "perception");
    setPassive("passiveInvestigation", "investigation");
    setPassive("passiveInsight", "insight");
    return summary;
  };

  Selectors.selectPreparedSpells = function selectPreparedSpells(spells) {
    const list = Array.isArray(spells) ? spells : [];
    return list.filter((spell) => spell && spell.prepared);
  };

  Selectors.selectPreparedSpellsByLevel = function selectPreparedSpellsByLevel(list) {
    const map = new Map();
    (Array.isArray(list) ? list : []).forEach((spell) => {
      const lvl = Number(spell?.level ?? 0);
      const key = Number.isFinite(lvl) ? Math.max(0, Math.min(9, lvl)) : 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(spell);
    });
    return map;
  };

  Selectors.selectInventoryHighlights = function selectInventoryHighlights(list, limit = 4) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, limit);
  };

  Selectors.selectNotesPreview = function selectNotesPreview(notes) {
    return (notes || "").trim();
  };
})();
