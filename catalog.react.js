(function () {
  const AppNS = (window.App = window.App || {});
  const cfg = window.RUNTIME_ENV || {};
  const SUPABASE_URL = cfg.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || "";
  const HAS_REST = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

  const HEADERS = () => ({
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
  });

  const buildURL = (table, params = {}) => {
    const url = new URL(SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table));
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  };

  async function getJSON(url) {
    const res = await fetch(url, { headers: HEADERS() });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      console.error("[Catalog REST]", res.status, res.statusText, body);
      return {
        ok: false,
        data: [],
        error: body || { message: res.statusText },
      };
    }
    return { ok: true, data: Array.isArray(body) ? body : [], error: null };
  }

  function toOrder(name, dir = "asc") {
    return `${name}.${dir}`;
  }

  async function listSpecies({ search = "", limit = 200 } = {}) {
    if (window.CatalogAPI?.listSpecies)
      return window.CatalogAPI.listSpecies({ search, limit });
    if (!HAS_REST) return [];
    const params = { select: "name", limit: String(limit) };
    if (search) params.name = `ilike.*${search}*`;
    const { ok, data } = await getJSON(buildURL("species", params));
    // Return [{id,name}] for UI
    return ok ? data.map((x) => ({ id: x.name, name: x.name })) : [];
  }

  async function listClasses({ search = "", limit = 200 } = {}) {
    if (window.CatalogAPI?.listClasses)
      return window.CatalogAPI.listClasses({ search, limit });
    if (!HAS_REST) return [];
    const params = {
      select: "id,name",
      limit: String(limit),
      order: toOrder("name", "asc"),
    };
    if (search) params.name = `ilike.*${search}*`;
    const { ok, data } = await getJSON(buildURL("classes", params));
    return ok ? data : [];
  }

  async function listWeapons({ search = "", limit = 50 } = {}) {
    if (window.CatalogAPI?.listWeapons)
      return window.CatalogAPI.listWeapons({ search, limit });
    if (!HAS_REST) return [];
    const params = {
      select:
        "id,name,category,weapon_group,damage_dice,damage_type,properties,weight,cost_gp,range_normal,range_long",
      limit: String(limit),
      order: toOrder("name", "asc"),
    };
    if (search) params.name = `ilike.*${search}*`;
    const { ok, data } = await getJSON(buildURL("weapons", params));
    return ok ? data : [];
  }

  async function listSpells(options = {}) {
    const {
      search = "",
      limit = 60,
      className = "",
      level,
      school = "",
      ritual,
      concentration,
    } = options;
    if (window.CatalogAPI?.listSpells)
      return window.CatalogAPI.listSpells(options);
    if (!HAS_REST) return [];
    const params = {
      select:
        [
          "id",
          "name",
          "level",
          "school",
          "casting_time",
          "range",
          "duration",
          "components",
          "materials",
          "concentration",
          "ritual",
          "classes",
          "lists",
          "text_md",
        ].join(","),
      limit: String(limit),
      order: ["level.asc", "name.asc"].join(","),
    };
    if (search) params.name = `ilike.*${search}*`;
    if (typeof level === "number" && Number.isFinite(level))
      params.level = `eq.${level}`;
    if (school) params.school = `eq.${school}`;
    if (ritual === true) params.ritual = "eq.true";
    if (ritual === false) params.ritual = "eq.false";
    if (concentration === true) params.concentration = "eq.true";
    if (concentration === false) params.concentration = "eq.false";
    if (className) {
      const encodedClass = encodeURIComponent(className);
      params.or = `(classes.cs.{${encodedClass}},lists.cs.{${encodedClass}})`;
    }
    const { ok, data } = await getJSON(buildURL("spells", params));
    return ok ? data : [];
  }

  async function getClassProgression({ classSlug, limit = 50 } = {}) {
    if (window.CatalogAPI?.getClassProgression)
      return window.CatalogAPI.getClassProgression({ classSlug, limit });
    if (!HAS_REST || !classSlug) return [];
    const params = {
      select:
        [
          "level",
          "proficiency_bonus",
          "class_die",
          "cantrips_known",
          "prepared_spells",
          "spell_slots",
          "feature_slugs",
          "notes",
          "source",
        ].join(","),
      class_slug: `eq.${classSlug}`,
      order: toOrder("level", "asc"),
      limit: String(limit),
    };
    const { ok, data } = await getJSON(buildURL("di_class_progressions", params));
    return ok ? data : [];
  }

  async function getClassFeatures({ classSlug, limit = 200 } = {}) {
    if (window.CatalogAPI?.getClassFeatures)
      return window.CatalogAPI.getClassFeatures({ classSlug, limit });
    if (!HAS_REST || !classSlug) return [];
    const params = {
      select: [
        "feature_slug",
        "title",
        "feature_type",
        "short_text",
        "detail_md",
        "source",
      ].join(","),
      class_slug: `eq.${classSlug}`,
      order: toOrder("feature_slug", "asc"),
      limit: String(limit),
    };
    const { ok, data } = await getJSON(buildURL("di_class_features", params));
    return ok ? data : [];
  }

  async function listClassSubclasses({ classSlug, limit = 50 } = {}) {
    if (window.CatalogAPI?.listClassSubclasses)
      return window.CatalogAPI.listClassSubclasses({ classSlug, limit });
    if (!HAS_REST || !classSlug) return [];
    const params = {
      select: ["subclass_slug", "title", "summary", "detail_md", "source"].join(","),
      class_slug: `eq.${classSlug}`,
      order: toOrder("title", "asc"),
      limit: String(limit),
    };
    const { ok, data } = await getJSON(buildURL("di_subclasses", params));
    return ok ? data : [];
  }

  async function getSubclassFeatures({ subclassSlug, limit = 50 } = {}) {
    if (window.CatalogAPI?.getSubclassFeatures)
      return window.CatalogAPI.getSubclassFeatures({ subclassSlug, limit });
    if (!HAS_REST || !subclassSlug) return [];
    const params = {
      select: ["feature_slug", "title", "level", "short_text", "detail_md", "source"].join(","),
      subclass_slug: `eq.${subclassSlug}`,
      order: [toOrder("level", "asc"), toOrder("title", "asc")].join(","),
      limit: String(limit),
    };
    const { ok, data } = await getJSON(buildURL("di_subclass_features", params));
    return ok ? data : [];
  }

  async function saveCharacter({ id, name, data }) {
    if (window.CatalogAPI?.saveCharacter)
      return window.CatalogAPI.saveCharacter({ id, name, data });
    if (!HAS_REST) return { id: id || "local-mock", name, data };
    // Upsert via PostgREST: Prefer: resolution=merge-duplicates if you've got unique keys
    const res = await fetch(buildURL("characters"), {
      method: "POST",
      headers: {
        ...HEADERS(),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([
        { id, user_id: null, name, data, updated_at: new Date().toISOString() },
      ]),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(body) || !body[0]) {
      console.error("[saveCharacter]", res.status, body);
      throw new Error("Backend save failed");
    }
    return body[0];
  }

  async function loadCharacter(id) {
    if (window.CatalogAPI?.loadCharacter)
      return window.CatalogAPI.loadCharacter(id);
    if (!HAS_REST) return null;
    const { ok, data } = await getJSON(
      buildURL("characters", {
        select: "id,name,data,updated_at",
        id: "eq." + id,
        limit: "1",
      })
    );
    return ok ? data[0] || null : null;
  }

  AppNS.Catalog = {
    listSpecies,
    listClasses,
    listWeapons,
    listSpells,
    saveCharacter,
    loadCharacter,
    getClassProgression,
    getClassFeatures,
    listClassSubclasses,
    getSubclassFeatures,
  };
})();
