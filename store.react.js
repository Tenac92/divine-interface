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
      // Normalize to old shape: .pack inferred from god
      res.data = res.data.map((x) => ({
        ...x,
        pack: !!x.god,
        description:
          typeof x.description === "string" ? x.description.trim() : "",
      }));
    }
    return res;
  }

  // PACKS fallback (if table not found or REST blocked)
  function listFromPacks(god) {
    const base = (window.PACKS?.BASE_ITEMS || []).map((x) => ({
      ...x,
      pack: false,
      description:
        typeof x.description === "string"
          ? x.description.trim()
          : typeof x.desc === "string"
          ? x.desc.trim()
          : "",
    }));
    const pack = (window.PACKS?.GOD_PACKS?.[god] || []).map((x) => ({
      ...x,
      pack: true,
      description:
        typeof x.description === "string"
          ? x.description.trim()
          : typeof x.desc === "string"
          ? x.desc.trim()
          : "",
    }));
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

    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    useEffect(() => {
      const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
      return () => clearTimeout(id);
    }, [query]);

    const [type, setType] = useState("All");
    const [sort, setSort] = useState("name");

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
    const owned = Array.isArray(profile?.owned) ? profile.owned : [];
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
      next.owned.push(it);
      await saveProfileAny(sess.username, next);
      setProfile(next);
      AppNS.toast && AppNS.toast("Relic claimed!");
    }

    async function refund(it) {
      if (!isAdmin) return;
      const fresh = await refreshProfile();
      if (!fresh) return;
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
        it.uses &&
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
            `Uses: ${it.uses}`
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
            isAdmin &&
              ownedAlready &&
              React.createElement(
                "button",
                {
                  className: "btn border-red-500",
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
            owned.map((it) =>
              React.createElement(
                "div",
                {
                  key: it.id,
                  style: {
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  },
                },
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
                  )
                ),
                React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    },
                  },
                  React.createElement(
                    "span",
                    {
                      className: "tag",
                      style: {
                        borderColor: it.god
                          ? "rgba(250, 204, 21, 0.35)"
                          : "rgba(125, 211, 252, 0.35)",
                      },
                    },
                    it.god ? "Patron Exclusive" : "Sanctum Supply"
                  ),
                  isAdmin
                    ? React.createElement(
                        "button",
                        {
                          className: "btn border-red-500",
                          style: { padding: "6px 12px" },
                          onClick: () => refund(it),
                          title: "Return half the FP to the player",
                        },
                        "Refund 50%"
                      )
                    : null
                )
              )
            )
          );

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
      filters,
      React.createElement(
        "div",
        { className: "grid gap-2" },
        React.createElement("h3", null, "Relics Available"),
        itemsGrid
      ),
      React.createElement(
        "div",
        { className: "grid gap-2" },
        React.createElement("h3", null, "Vaulted Treasures"),
        ownedSection
      ),
      adminControls
    );
  }
  AppNS.StorePage = StorePage;
})();




