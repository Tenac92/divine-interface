/* catalog.supabase.js — tiny API wrapper for your Supabase catalog tables
   Expected tables/views (you can rename; update queries accordingly):
   - species(id, name)
   - classes(id, name)
   - weapons(id, name, category, weapon_group, damage_dice, damage_type, properties, weight, cost_gp, range_normal, range_long)
   - spells(id, name, level, school, casting_time)
   - characters(id, data jsonb, name text, updated_at timestamptz)  -- optional helper
*/
(function () {
  "use strict";

  // Prefer REST to avoid bundling the Supabase JS client, but support either.
  const cfg = window.RUNTIME_ENV || {};
  const SUPABASE_URL = cfg.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || "";

  const hasRest = SUPABASE_URL && SUPABASE_ANON_KEY;
  const defaultHeaders = () => ({
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
  });

  async function restSelect(
    table,
    { select = "*", limit = 50, search, order = "name.asc" } = {}
  ) {
    if (!hasRest) return mockList(table, { limit, search });
    const url = new URL(SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table));
    url.searchParams.set("select", select);
    if (limit) url.searchParams.set("limit", String(limit));
    // rudimentary text search on name (ilike)
    if (search) url.searchParams.set("name", `ilike.*${search}*`);
    if (order) {
      const [col, dir] = order.split(".");
      url.searchParams.set("order", col);
      url.searchParams.set("ascending", String(dir !== "desc"));
    }
    const res = await fetch(url, { headers: defaultHeaders() });
    if (!res.ok)
      throw new Error(
        "REST select failed: " + res.status + " " + (await res.text())
      );
    return await res.json();
  }

  // Basic mocks so UI is interactive even without backend
  function mockList(table, { limit = 20, search } = {}) {
    const lc = (s) => (s || "").toLowerCase();
    if (table === "species") {
      const data = [
        "Human",
        "Elf",
        "Dwarf",
        "Halfling",
        "Orc",
        "Tiefling",
        "Gnome",
      ].map((n, i) => ({ id: i + 1, name: n }));
      return Promise.resolve(
        data
          .filter((x) => !search || lc(x.name).includes(lc(search)))
          .slice(0, limit)
      );
    }
    if (table === "classes") {
      const data = [
        "Fighter",
        "Wizard",
        "Rogue",
        "Cleric",
        "Barbarian",
        "Paladin",
        "Ranger",
        "Bard",
      ].map((n, i) => ({ id: i + 1, name: n }));
      return Promise.resolve(
        data
          .filter((x) => !search || lc(x.name).includes(lc(search)))
          .slice(0, limit)
      );
    }
    if (table === "weapons") {
      const data = [
        {
          id: 1,
          name: "Longsword",
          category: "Martial",
          weapon_group: "Sword",
          damage_dice: "1d8",
          damage_type: "slashing",
          properties: "versatile (1d10)",
          weight: 3,
          cost_gp: 15,
        },
        {
          id: 2,
          name: "Shortbow",
          category: "Simple",
          weapon_group: "Bow",
          damage_dice: "1d6",
          damage_type: "piercing",
          properties: "ammunition, two-handed, range (80/320)",
          weight: 2,
          cost_gp: 25,
        },
        {
          id: 3,
          name: "Dagger",
          category: "Simple",
          weapon_group: "Knife",
          damage_dice: "1d4",
          damage_type: "piercing",
          properties: "finesse, light, thrown (20/60)",
          weight: 1,
          cost_gp: 2,
        },
      ];
      return Promise.resolve(
        data
          .filter((x) => !search || lc(x.name).includes(lc(search)))
          .slice(0, limit)
      );
    }
    if (table === "spells") {
      const data = [
        {
          id: 1,
          name: "Magic Missile",
          level: 1,
          school: "Evocation",
          casting_time: "1 action",
        },
        {
          id: 2,
          name: "Shield",
          level: 1,
          school: "Abjuration",
          casting_time: "1 reaction",
        },
        {
          id: 3,
          name: "Fireball",
          level: 3,
          school: "Evocation",
          casting_time: "1 action",
        },
      ];
      return Promise.resolve(
        data
          .filter((x) => !search || lc(x.name).includes(lc(search)))
          .slice(0, limit)
      );
    }
    if (table === "characters") {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }

  // Character helpers (optional; use your own tables if you prefer)
  async function upsertCharacter({ id, name, data }) {
    if (!hasRest) return { id: id || "local-mock", name, data };
    const table = "characters";
    const url = new URL(SUPABASE_URL + "/rest/v1/" + table);
    const body = [{ id, name, data, updated_at: new Date().toISOString() }];
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...defaultHeaders(),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(
        "Upsert failed: " + res.status + " " + (await res.text())
      );
    const out = await res.json();
    return out[0] || { id, name, data };
  }
  async function getCharacter(id) {
    if (!hasRest) return null;
    const url = new URL(SUPABASE_URL + "/rest/v1/characters");
    url.searchParams.set("id", "eq." + id);
    url.searchParams.set("select", "id,name,data,updated_at");
    const res = await fetch(url, { headers: defaultHeaders() });
    if (!res.ok)
      throw new Error(
        "Fetch character failed: " + res.status + " " + (await res.text())
      );
    const arr = await res.json();
    return arr[0] || null;
  }

  window.CatalogAPI = {
    async listSpecies(opts = {}) {
      return restSelect("species", opts);
    },
    async listClasses(opts = {}) {
      return restSelect("classes", opts);
    },
    async listWeapons(opts = {}) {
      return restSelect("weapons", opts);
    },
    async listSpells(opts = {}) {
      return restSelect("spells", opts);
    },

    // Character I/O
    async saveCharacter(payload) {
      return upsertCharacter(payload);
    },
    async loadCharacter(id) {
      return getCharacter(id);
    },
  };
})();
