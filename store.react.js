(function () {
  const AppNS = (window.App = window.App || {});
  const { useEffect, useMemo, useState } = React;

  // ---------- REST env ----------
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
    try {
      const res = await fetch(url, { headers: HEADERS() });
      let body = null;
      try {
        body = await res.json();
      } catch {}
      if (!res.ok) {
        console.error("[FaithStore REST]", res.status, res.statusText, body);
        return {
          ok: false,
          data: [],
          error: body || { message: res.statusText },
        };
      }
      return { ok: true, data: Array.isArray(body) ? body : [], error: null };
    } catch (e) {
      console.error("[FaithStore REST] fetch failed", e);
      return { ok: false, data: [], error: e };
    }
  }

  // ---------- Session + RemoteStore fallbacks ----------
  const hasCore = !!(
    window.Core && typeof window.Core.getSession === "function"
  );
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

  // ---------- Domain ----------
  const RANKS = [
    { min: -999, name: "Forsaken" },
    { min: -4, name: "Distant" },
    { min: 1, name: "Favored" },
    { min: 5, name: "Blessed" },
    { min: 10, name: "Chosen" },
    { min: 15, name: "Exemplar" },
  ];
  const rankFromFP = (fp) => [...RANKS].reverse().find((r) => fp >= r.min).name;

  function defaultProfile(username) {
    return {
      id: Math.random().toString(36).slice(2, 10),
      name: username,
      god: "Tyr/Bahamut",
      level: 1,
      fp: 10,
      owned: [],
      lock: false,
    };
  }

  // REST-powered list: Base (god IS NULL) + specific god
  async function listFaithItems({ god = "Tyr/Bahamut", sort = "name" } = {}) {
    if (!HAS_REST) return { ok: false, data: [] };
    const order =
      sort === "cost" ? "sort_index.asc,cost.asc,name.asc" : "sort_index.asc,name.asc";
    // NOTE: PostgREST OR: or=(god.is.null,god.eq.X)
    const params = {
      select: "id,type,name,cost,description:desc,god,active,sort_index,uses",
      or: `(god.is.null,god.eq.${god})`,
      active: "eq.true",
      order,
      limit: "500",
    };
    const res = await getJSON(buildURL("faith_items", params));
    if (res.ok) {
      // Normalize to old shape and include uses metadata
      res.data = res.data.map((x) => normalizeItem(x));
    }
    return res;
  }

  // PACKS fallback (if table not found or REST blocked)
  function listFromPacks(god) {
    const base = (window.PACKS?.BASE_ITEMS || []).map((x) =>
      normalizeItem(x, { pack: false })
    );
    const pack = (window.PACKS?.GOD_PACKS?.[god] || []).map((x) =>
      normalizeItem(x, { pack: true })
    );
    return [...base, ...pack];
  }

  const debounce = (fn, ms = 300) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  function itemMatches(it, term) {
    if (!term) return true;
    const t = term.toLowerCase();
    return (
      it.name?.toLowerCase?.().includes(t) ||
      (it.description || "").toLowerCase().includes(t) ||
      (it.type || "").toLowerCase().includes(t)
    );
  }
  const UNKNOWN_TYPE = "Unclassified";
  function filterByType(items, type) {
    if (!type || type === "All") return items;
    if (type === UNKNOWN_TYPE) return items.filter((x) => !x.type);
    return items.filter(
      (x) => (x.type || "").toLowerCase() === type.toLowerCase()
    );
  }
  function sortItems(items, sortMode) {
    const arr = [...items];
    if (sortMode === "cost")
      arr.sort(
        (a, b) => (a.cost ?? 0) - (b.cost ?? 0) || a.name.localeCompare(b.name)
      );
    else arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }

  const safeJSONParse = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  function normalizeUsesValue(value) {
    if (value == null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        const parsed = safeJSONParse(trimmed);
        if (parsed !== null) return normalizeUsesValue(parsed);
      }
      const maybeNum = Number(trimmed);
      if (Number.isFinite(maybeNum)) {
        return { label: "Uses", max: Math.max(0, maybeNum) };
      }
      return { label: trimmed };
    }
    if (typeof value === "number") {
      return { label: "Uses", max: Math.max(0, value) };
    }
    if (Array.isArray(value)) {
      const mapped = value.map(normalizeUsesValue).filter(Boolean);
      return mapped.length ? mapped : null;
    }
    if (typeof value === "object") {
      const meta = {};
      if (value === null) return null;
      const maxSource =
        value.max ??
        value.total ??
        value.count ??
        value.limit ??
        value.charges ??
        value.value;
      if (Number.isFinite(Number(maxSource))) {
        meta.max = Math.max(0, Number(maxSource));
      }
      const labelCandidate =
        value.label ||
        value.name ||
        value.title ||
        value.text ||
        (typeof value.desc === "string" ? value.desc : null) ||
        (typeof value.description === "string" ? value.description : null);
      meta.label = labelCandidate || "Uses";
      const reset =
        value.reset || value.refresh || value.per || value.interval || value.cycle;
      if (reset) meta.reset = reset;
      const note = value.note || value.notes;
      if (note) meta.note = note;
      return meta;
    }
    return null;
  }

  function getUsesMeta(source, isRaw = false) {
    if (!source) return null;
    if (!isRaw && typeof source === "object" && !Array.isArray(source)) {
      if (source.usesMeta) return getUsesMeta(source.usesMeta, true);
      if (Object.prototype.hasOwnProperty.call(source, "uses")) {
        return getUsesMeta(source.uses, true);
      }
    }
    const normalized = normalizeUsesValue(source);
    if (!normalized) return null;
    if (Array.isArray(normalized)) return normalized[0] || null;
    return normalized;
  }

  function formatUsesSummary(meta) {
    if (!meta) return "";
    const label = meta.label || "Uses";
    const parts = [];
    if (Number.isFinite(meta.max)) {
      parts.push(`${meta.max} charge${meta.max === 1 ? "" : "s"}`);
    }
    if (meta.reset) {
      parts.push(`per ${meta.reset}`);
    }
    if (!parts.length && meta.note) parts.push(meta.note);
    if (!parts.length) return label;
    return `${label}: ${parts.join(" / ")}`;
  }

  function getChargeTrackingState(item) {
    const usesMeta = getUsesMeta(item);
    if (!usesMeta || !Number.isFinite(usesMeta.max)) return null;
    const max = Math.max(0, usesMeta.max);
    const used = Math.min(Math.max(Number(item?.chargesUsed) || 0, 0), max);
    return {
      usesMeta,
      max,
      used,
      remaining: Math.max(max - used, 0),
    };
  }

  function normalizeItem(raw, overrides = {}) {
    if (!raw || typeof raw !== "object") return raw;
    const description =
      typeof raw.description === "string"
        ? raw.description.trim()
        : typeof raw.desc === "string"
        ? raw.desc.trim()
        : "";
    const item = {
      ...raw,
      ...overrides,
      description,
    };
    if (!Object.prototype.hasOwnProperty.call(overrides, "pack")) {
      item.pack = !!item.god;
    }
    const usesMeta = getUsesMeta(item);
    if (usesMeta) item.usesMeta = usesMeta;
    return item;
  }

  // ---------- UI bits ----------
  const Btn = (p) =>
    React.createElement(
      "button",
      Object.assign({ className: "btn" }, p),
      p.children
    );
  const Card = (p) =>
    React.createElement(
      "div",
      Object.assign({ className: "card" }, p),
      p.children
    );
  const Row = (p) =>
    React.createElement(
      "div",
      Object.assign({ className: "row" }, p),
      p.children
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

  function StorePage() {
    const sess = getSessionSafe();
    const isAdmin = sess?.role === "admin";

    if (!sess || !sess.username) {
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
          "Sign in to view your divine store inventory."
        )
      );
    }

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [usingFallback, setUsingFallback] = useState(false);

    const catalogById = useMemo(() => {
      const map = new Map();
      (items || []).forEach((it) => {
        if (it?.id) map.set(it.id, it);
      });
      return map;
    }, [items]);

    function hydrateOwnedEntry(entry) {
      if (!entry || typeof entry !== "object") return entry;
      const base = entry.id ? catalogById.get(entry.id) : null;
      const merged = base
        ? {
            ...base,
            ...entry,
            pack:
              typeof entry.pack === "boolean"
                ? entry.pack
                : typeof base.pack === "boolean"
                ? base.pack
                : !!entry.god,
          }
        : { ...entry };
      const normalized = normalizeItem(merged);
      const chargesUsed = Number.isFinite(Number(entry.chargesUsed))
        ? Number(entry.chargesUsed)
        : Number(normalized.chargesUsed) || 0;
      normalized.chargesUsed = chargesUsed;
      return normalized;
    }

    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    useEffect(() => {
      const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
      return () => clearTimeout(id);
    }, [query]);

    const [type, setType] = useState("All");
    const [sort, setSort] = useState("name");
    const [activeView, setActiveView] = useState("store");

    useEffect(() => {
      let active = true;
      (async () => {
        setLoading(true);
        let prof = await loadProfileAny(sess.username);
        if (!prof) {
          prof = defaultProfile(sess.username);
          await saveProfileAny(sess.username, prof);
        }
        if (active) {
          setProfile(prof);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [sess.username]);

    useEffect(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        if (HAS_REST) {
          const { ok, data } = await listFaithItems({ god: profile.god, sort });
          if (ok && !cancelled) {
            setItems(data);
            setUsingFallback(false);
            return;
          }
        }
        if (!cancelled) {
          setItems(listFromPacks(profile.god));
          setUsingFallback(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [profile?.god, sort]);

    const filteredItems = useMemo(() => {
      const bySearch = items.filter((it) => itemMatches(it, debouncedQuery));
      const byType = filterByType(bySearch, type);
      return usingFallback ? sortItems(byType, sort) : byType;
    }, [items, debouncedQuery, type, sort, usingFallback]);

    const typeOptions = useMemo(() => {
      const set = new Set(
        (items || []).map((it) => (it.type && it.type.trim()) || UNKNOWN_TYPE)
      );
      return ["All", ...Array.from(set).sort()];
    }, [items]);
    useEffect(() => {
      if (!typeOptions.includes(type)) {
        setType("All");
      }
    }, [typeOptions, type]);

    const fp = profile?.fp ?? 0;
    const rank = rankFromFP(fp);
    const owned = useMemo(() => {
      const raw = Array.isArray(profile?.owned) ? profile.owned : [];
      return raw.map((entry) => hydrateOwnedEntry(entry) || entry);
    }, [profile?.owned, catalogById]);
    const ownedCount = owned.length;
    const nextRank = [...RANKS].find((r) => r.min > fp);
    const journeyHint = nextRank
      ? `Collect ${nextRank.min - fp} more FP to attain the rank of ${nextRank.name}.`
      : "You already stand at the pinnacle of divine favor.";

    async function refreshProfile() {
      const fresh = await loadProfileAny(sess.username);
      if (fresh) setProfile(fresh);
      return fresh || profile;
    }

    async function buy(it) {
      const fresh = await refreshProfile();
      if (!fresh || fresh.lock) return;
      if ((fresh.owned || []).some((o) => o.id === it.id)) return;
      if ((fresh.fp ?? 0) < (it.cost ?? 0)) return;

      const next = { ...fresh };
      next.fp = (next.fp ?? 0) - (it.cost ?? 0);
      next.owned = Array.isArray(next.owned) ? next.owned.slice() : [];
      next.owned.push({ ...it, chargesUsed: 0 });
      await saveProfileAny(sess.username, next);
      setProfile(next);
      AppNS.toast && AppNS.toast("Relic claimed!");
    }

    async function refund(it) {
      const fresh = await refreshProfile();
      if (!fresh) return;
      if (fresh.lock) {
        AppNS.toast && AppNS.toast("Store is locked. Refund unavailable.");
        return;
      }
      const ix = (fresh.owned || []).findIndex((o) => o.id === it.id);
      if (ix < 0) return;

      const next = { ...fresh };
      next.owned = fresh.owned.slice();
      next.owned.splice(ix, 1);
      next.fp = (next.fp ?? 0) + Math.floor((it.cost ?? 0) * 0.5);
      await saveProfileAny(sess.username, next);
      setProfile(next);
      AppNS.toast && AppNS.toast("Refund processed.");
    }

    async function mutateOwnedCharge(index, updater) {
      const fresh = await refreshProfile();
      if (!fresh) return;
      const list = Array.isArray(fresh.owned) ? fresh.owned.slice() : [];
      const target = list[index];
      if (!target) return;
      const hydrated = hydrateOwnedEntry(target) || target;
      const state = getChargeTrackingState(hydrated);
      if (!state) {
        AppNS.toast && AppNS.toast("This relic has no charges to track.");
        return;
      }
      const desired = updater(state);
      if (!Number.isFinite(desired)) return;
      const clamped = Math.min(Math.max(desired, 0), state.max);
      if (clamped === state.used) {
        AppNS.toast &&
          AppNS.toast(
            state.used >= state.max
              ? "All charges already spent."
              : "No charges spent yet."
          );
        return;
      }
      const updated = { ...hydrated, chargesUsed: clamped };
      list[index] = updated;
      const next = { ...fresh, owned: list };
      await saveProfileAny(sess.username, next);
      setProfile(next);
      const message =
        clamped === 0
          ? `Charges reset for ${hydrated.name}.`
          : `Charge ${clamped}/${state.max} recorded for ${hydrated.name}.`;
      AppNS.toast && AppNS.toast(message);
    }

    const spendCharge = (index) =>
      mutateOwnedCharge(index, (state) => Math.min(state.used + 1, state.max));

    const resetCharges = (index) => mutateOwnedCharge(index, () => 0);

    async function adjustFP(delta) {
      const next = { ...(await refreshProfile()) };
      next.fp = (next.fp ?? 0) + delta;
      await saveProfileAny(sess.username, next);
      setProfile(next);
    }

    async function setFP(val) {
      const n = Number(val);
      if (!Number.isFinite(n)) return;
      const next = { ...(await refreshProfile()) };
      next.fp = n;
      await saveProfileAny(sess.username, next);
      setProfile(next);
    }

    async function changeGod(newGod) {
      const next = { ...(await refreshProfile()) };
      next.god = newGod;
      await saveProfileAny(sess.username, next);
      setProfile(next);
    }

    if (loading || !profile)
      return React.createElement(Card, null, "Calibrating astral storefront...");

    const hero = React.createElement(
      Card,
      {
        style: {
          background:
            "linear-gradient(130deg, rgba(125,211,252,0.15), rgba(59,130,246,0.12) 55%, rgba(244,114,182,0.18))",
          borderColor: "rgba(125, 211, 252, 0.35)",
          boxShadow: "0 24px 55px rgba(7,12,20,0.45)",
        },
      },
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12 } },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            },
          },
          React.createElement(
            "div",
            { style: { flex: 1, minWidth: 0 } },
            React.createElement(
              "div",
              { style: { fontSize: 14, opacity: 0.7, letterSpacing: 1 } },
              "Transference Complete"
            ),
            React.createElement(
              "div",
              { style: { fontSize: 28, fontWeight: 700 } },
              `Welcome, ${profile.name || sess.username}`
            ),
            React.createElement(
              "div",
              { style: { opacity: 0.75, marginTop: 6, fontSize: 14 } },
              `You arrive within the Sanctum Exchange. Align with ${profile.god} and requisition the relics that will anchor you to this world.`
            )
          ),
          React.createElement(
            "span",
            {
              className: "tag",
              style: {
                background: "rgba(125,211,252,0.18)",
                borderColor: "rgba(125,211,252,0.45)",
                fontWeight: 600,
              },
            },
            rank
          )
        ),
        React.createElement(
          "div",
          { style: { fontSize: 13, opacity: 0.7 } },
          journeyHint
        )
      )
    );

    const statGrid = React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        },
      },
      [
        ["Faith Points", fp, "Current reserves"],
        ["Rank", rank, nextRank ? `Next: ${nextRank.name}` : "Top rank achieved"],
        ["Level", profile.level ?? 1, "Your mortal potential"],
        ["Patron", profile.god, "Divine alignment"],
        ["Relics Claimed", ownedCount, "Treasures bound to you"],
      ].map(([label, value, hint]) =>
        React.createElement(
          Card,
          {
            key: label,
            style: {
              padding: 14,
              background: "rgba(18, 24, 36, 0.9)",
              borderColor: "rgba(125, 211, 252, 0.15)",
            },
          },
          React.createElement(
            "div",
            { style: { fontSize: 12, opacity: 0.75 } },
            label
          ),
          React.createElement(
            "div",
            { style: { fontSize: 20, fontWeight: 700 } },
            value
          ),
          hint &&
            React.createElement(
              "div",
              { style: { fontSize: 12, opacity: 0.65, marginTop: 4 } },
              hint
            )
        )
      )
    );

    const allowGodSwitch = isAdmin;
    const patronControl = allowGodSwitch
      ? React.createElement(
          Field,
          { label: "Patron Alignment", hint: "Switching refreshes the store list" },
          React.createElement(
            "select",
            {
              className: "ui-select",
              value: profile.god,
              onChange: (e) => changeGod(e.target.value),
            },
            ["Tyr/Bahamut", "Raven Queen", "Silvanus", "Corellon"].map((g) =>
              React.createElement("option", { key: g, value: g }, g)
            )
          )
        )
      : React.createElement(
          Field,
          {
            label: "Patron Alignment",
            hint: "Ask your DM if you need this changed",
          },
          React.createElement(
            "div",
            { className: "ui-static", style: { fontWeight: 600 } },
            React.createElement("span", null, profile.god),
            React.createElement(
              "span",
              { className: "ui-hint", style: { textTransform: "none" } },
              "Locked by DM"
            )
          )
        );

    const filters = React.createElement(
      Card,
      { style: { display: "grid", gap: 12 } },
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          },
        },
        patronControl,
        React.createElement(
          Field,
          { label: "Category" },
          React.createElement(
            "select",
            {
              className: "ui-select",
              value: type,
              onChange: (e) => setType(e.target.value),
            },
            typeOptions.map((opt) =>
              React.createElement(
                "option",
                { key: opt, value: opt },
                opt === UNKNOWN_TYPE ? "Misc" : opt
              )
            )
          )
        ),
        React.createElement(
          Field,
          { label: "Sort Order" },
          React.createElement(
            "select",
            {
              className: "ui-select",
              value: sort,
              onChange: (e) => setSort(e.target.value),
            },
            [
              { value: "name", text: "Name" },
              { value: "cost", text: "Cost" },
            ].map((opt) =>
              React.createElement("option", { key: opt.value, value: opt.value }, opt.text)
            )
          )
        ),
        React.createElement(
          Field,
          { label: "Search" },
          React.createElement("input", {
            className: "ui-input",
            placeholder: "name or description",
            value: query,
            onChange: (e) => setQuery(e.target.value),
          })
        )
      ),
      usingFallback &&
        React.createElement(
          "div",
          {
            className: "tag",
            style: {
              width: "fit-content",
              borderColor: "rgba(249, 115, 22, 0.4)",
              background: "rgba(249, 115, 22, 0.1)",
            },
          },
          "Offline cache active (PACKS data)"
        )
    );

    const viewTabs = React.createElement(
      Card,
      {
        style: {
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "stretch",
        },
      },
      [
        { key: "store", label: "Relics Store" },
        { key: "vault", label: "My Vault" },
      ].map((tab) => {
        const active = activeView === tab.key;
        const baseStyle = {
          flex: "1 1 160px",
          minWidth: 140,
          justifyContent: "center",
        };
        const variantStyle = active
          ? {
              borderColor: "rgba(96, 165, 250, 0.9)",
              background: "rgba(37, 99, 235, 0.25)",
              color: "#f8fafc",
              opacity: 1,
            }
          : {
              borderColor: "rgba(148, 163, 184, 0.35)",
              background: "rgba(15, 23, 42, 0.6)",
              color: "#e2e8f0",
              opacity: 0.75,
            };
        return React.createElement(
          Btn,
          {
            key: tab.key,
            onClick: () => setActiveView(tab.key),
            style: Object.assign({}, baseStyle, variantStyle),
            "aria-pressed": active,
            type: "button",
          },
          tab.label
        );
      })
    );

    function ItemCard({ it }) {
      const ownedAlready = owned.some((o) => o.id === it.id);
      const disableBuy =
        ownedAlready || (profile.fp ?? 0) < (it.cost ?? 0) || profile.lock;
      const whyDisabled = profile.lock
        ? "Store is locked"
        : ownedAlready
        ? "Already claimed"
        : (profile.fp ?? 0) < (it.cost ?? 0)
        ? "Not enough FP"
        : "";
      const accent = it.god ? "rgba(250, 204, 21, 0.35)" : "rgba(125, 211, 252, 0.35)";
      const usesMeta = getUsesMeta(it);
      return React.createElement(
        Card,
        {
          key: it.id,
          style: {
            borderColor: accent,
            background: "rgba(12, 19, 30, 0.92)",
            display: "grid",
            gap: 12,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            },
          },
          React.createElement(
            "div",
            { style: { flex: 1, minWidth: 0 } },
            React.createElement(
              "div",
              { style: { fontSize: 18, fontWeight: 700 } },
              it.name
            ),
            React.createElement(
              "div",
              { style: { fontSize: 12, opacity: 0.7, marginTop: 2 } },
              it.type || "Relic"
            )
          ),
          React.createElement(
            "span",
            {
              className: "tag",
              style: {
                background: it.god ? "rgba(250, 204, 21, 0.15)" : "rgba(125, 211, 252, 0.15)",
                borderColor: accent,
              },
            },
            it.god ? "Patron Exclusive" : "Sanctum Supply"
          )
        ),
        it.description &&
          React.createElement(
            "div",
            { style: { opacity: 0.75, fontSize: 14, lineHeight: 1.5 } },
            it.description
          ),
        usesMeta &&
          React.createElement(
            "div",
            {
              className: "tag",
              style: {
                borderColor: accent,
                width: "fit-content",
                fontSize: 12,
              },
            },
            formatUsesSummary(usesMeta)
          ),
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            },
          },
          React.createElement(
            "div",
            { className: "tag", style: { borderColor: accent } },
            `Cost: ${it.cost ?? 0} FP`
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: 8, alignItems: "center" } },
            ownedAlready &&
              React.createElement(
                "span",
                { style: { fontSize: 12, opacity: 0.7 } },
                "Already in your vault"
              ),
            React.createElement(
              "button",
              {
                className: "btn",
                disabled: disableBuy,
                title: whyDisabled,
                onClick: () => buy(it),
              },
              ownedAlready ? "Claimed" : "Claim Relic"
            ),
            ownedAlready &&
              React.createElement(
                "button",
                {
                  className: "btn border-red-500",
                  disabled: profile.lock,
                  title: profile.lock ? "Store is locked" : "Return half the FP to your pool",
                  onClick: () => refund(it),
                },
                "Refund 50%"
              )
          )
        )
      );
    }

    const itemsGrid =
      filteredItems.length === 0
        ? React.createElement(
            Card,
            { style: { opacity: 0.75, textAlign: "center" } },
            "No relics match your filters yet."
          )
        : React.createElement(
            "div",
            {
              style: {
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              },
            },
            filteredItems.map((it) => React.createElement(ItemCard, { key: it.id, it }))
          );

    const ownedSection =
      ownedCount === 0
        ? React.createElement(
            Card,
            { style: { opacity: 0.7 } },
            "Your vault is empty. Claim relics to anchor your legend."
          )
        : React.createElement(
            Card,
            {
              style: {
                display: "grid",
                gap: 8,
              },
            },
            owned.map((it, idx) => {
              const charges = getChargeTrackingState(it);
              const accent = it.god
                ? "rgba(250, 204, 21, 0.35)"
                : "rgba(125, 211, 252, 0.35)";
              const rowStyle = {
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              };
              if (charges) {
                rowStyle.cursor = "pointer";
                rowStyle.border = "1px dashed rgba(148, 163, 184, 0.35)";
                rowStyle.borderRadius = 8;
                rowStyle.padding = 12;
                rowStyle.background = "rgba(15, 23, 42, 0.4)";
              }
              const interactiveProps = charges
                ? {
                    onClick: () => spendCharge(idx),
                    role: "button",
                    tabIndex: 0,
                    onKeyDown: (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        spendCharge(idx);
                      }
                    },
                  }
                : {};
              return React.createElement(
                "div",
                Object.assign(
                  {
                    key: `${it.id}:${idx}`,
                    style: rowStyle,
                    title: charges
                      ? `Click to spend a charge (${charges.remaining} remaining)`
                      : undefined,
                  },
                  interactiveProps
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement(
                    "div",
                    { style: { fontWeight: 600 } },
                    it.name
                  ),
                  React.createElement(
                    "div",
                    { style: { fontSize: 12, opacity: 0.7 } },
                    `${it.type || "Relic"} - ${it.cost ?? 0} FP`
                  ),
                  it.description
                    ? React.createElement(
                        "div",
                        {
                          style: {
                            fontSize: 12,
                            opacity: 0.75,
                            marginTop: 4,
                            lineHeight: 1.4,
                          },
                        },
                        it.description
                      )
                    : null
                ),
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                      flex: "0 1 auto",
                    },
                  },
                  React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "flex-end",
                      },
                    },
                    React.createElement(
                      "span",
                      {
                        className: "tag",
                        style: {
                          borderColor: accent,
                        },
                      },
                      it.god ? "Patron Exclusive" : "Sanctum Supply"
                    ),
                    React.createElement(
                      "button",
                      {
                        className: "btn border-red-500",
                        style: { padding: "6px 12px" },
                        disabled: profile.lock,
                        title: profile.lock
                          ? "Store is locked"
                          : "Return half the FP to your pool",
                        onClick: (e) => {
                          e.stopPropagation();
                          refund(it);
                        },
                      },
                      "Refund 50%"
                    )
                  ),
                  charges
                    ? React.createElement(
                        "div",
                        {
                          style: {
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            alignItems: "center",
                            justifyContent: "flex-end",
                            fontSize: 12,
                          },
                        },
                        React.createElement(
                          "span",
                          {
                            className: "tag",
                            style: {
                              borderColor: accent,
                            },
                          },
                          `${(charges.usesMeta.label || "Charges")}: ${charges.used}/${
                            charges.max
                          }${
                            charges.usesMeta.reset ? ` / ${charges.usesMeta.reset}` : ""
                          }`
                        ),
                        React.createElement(
                          "span",
                          { style: { opacity: 0.7 } },
                          "Click entry to spend a charge"
                        ),
                        charges.used > 0 &&
                          React.createElement(
                            "button",
                            {
                              className: "btn border-slate-500",
                              onClick: (e) => {
                                e.stopPropagation();
                                resetCharges(idx);
                              },
                            },
                            "Reset"
                          )
                      )
                    : null
                )
              );
            })
          );

    const storeSection = React.createElement(
      "div",
      { className: "grid gap-3" },
      filters,
      React.createElement(
        "div",
        { className: "grid gap-2" },
        React.createElement("h3", null, "Relics Available"),
        itemsGrid
      )
    );

    const vaultSection = React.createElement(
      "div",
      { className: "grid gap-2" },
      React.createElement("h3", null, "Vaulted Treasures"),
      ownedSection
    );

    const activeSection = activeView === "store" ? storeSection : vaultSection;

    const lockBanner = profile.lock
      ? React.createElement(
          Card,
          {
            style: {
              background: "rgba(239, 68, 68, 0.08)",
              borderColor: "rgba(239, 68, 68, 0.4)",
            },
          },
          React.createElement(
            Row,
            { style: { justifyContent: "space-between" } },
            React.createElement(
              "div",
              { style: { color: "#ef4444", fontWeight: 600 } },
              "Store Locked"
            ),
            React.createElement(
              "div",
              { style: { opacity: 0.8 } },
              "Purchases are disabled. Consult your guide or DM."
            )
          )
        )
      : null;

    const adminControls = !isAdmin
      ? null
      : React.createElement(
          Card,
          {
            style: {
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
            },
          },
          React.createElement(
            "div",
            { style: { fontWeight: 600 } },
            "Admin Controls"
          ),
          React.createElement("div", { className: "tag" }, `FP: ${fp}`),
          React.createElement(
            Btn,
            { onClick: () => adjustFP(+1) },
            "+1 FP"
          ),
          React.createElement(
            Btn,
            { onClick: () => adjustFP(-1) },
            "-1 FP"
          ),
          React.createElement(
            Btn,
            { onClick: () => adjustFP(+5) },
            "+5 FP"
          ),
          React.createElement(
            Btn,
            { onClick: () => adjustFP(-5) },
            "-5 FP"
          ),
          React.createElement(
          "label",
          { className: "ui-field", style: { margin: 0, width: 140 } },
            React.createElement("span", { style: { opacity: 0.7 } }, "Set FP"),
            React.createElement("input", {
              className: "btn w-full",
              type: "number",
              placeholder: String(fp),
              onKeyDown: (e) => {
                if (e.key === "Enter") setFP(e.currentTarget.value);
              },
              title: "Type a number and press Enter",
            })
          )
        );

    return React.createElement(
      "div",
      { className: "grid gap-4" },
      hero,
      statGrid,
      lockBanner,
      viewTabs,
      activeSection,
      adminControls
    );
  }
  AppNS.StorePage = StorePage;
})();





