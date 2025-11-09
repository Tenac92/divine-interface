(function () {
  const AppNS = (window.App = window.App || {});

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

  const SKILL_ABILITY_MAP = {
    Str: "str",
    Dex: "dex",
    Con: "con",
    Int: "int",
    Wis: "wis",
    Cha: "cha",
  };

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

  AppNS.SheetConstants = {
    XP_TABLE,
    ABILITIES,
    SKILLS,
    SKILL_ABILITY_MAP,
    SPELL_SCHOOLS,
    DEFAULT_CLASS_OPTIONS,
    DEFAULT_SPECIES_OPTIONS,
  };
})();

