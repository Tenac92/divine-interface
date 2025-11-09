(function () {
  const AppNS = (window.App = window.App || {});
  const Hooks = (AppNS.SheetHooks = AppNS.SheetHooks || {});
  const React = window.React;
  if (!React) return;
  const { useEffect, useState, useRef } = React;

  Hooks.useClassCatalog = function useClassCatalog({ catalog, hasClassCatalog, initial = [] }) {
    const [options, setOptions] = useState(initial);
    useEffect(() => {
      if (!hasClassCatalog || typeof catalog?.listClasses !== "function") return undefined;
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
          if (normalized.length) setOptions(normalized);
        } catch (err) {
          console.warn("[Sheet] load class catalog failed", err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [catalog, hasClassCatalog]);
    return options;
  };

  Hooks.useSpeciesCatalog = function useSpeciesCatalog({ catalog, hasSpeciesCatalog, initial = [] }) {
    const [options, setOptions] = useState(initial);
    useEffect(() => {
      if (!hasSpeciesCatalog || typeof catalog?.listSpecies !== "function") return undefined;
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
          if (normalized.length) setOptions(normalized);
        } catch (err) {
          console.warn("[Sheet] load species catalog failed", err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [catalog, hasSpeciesCatalog]);
    return options;
  };

  Hooks.useStoreItems = function useStoreItems({ enabled, fetchFaithItems, limit = 400 }) {
    const [items, setItems] = useState([]);
    useEffect(() => {
      if (!enabled || typeof fetchFaithItems !== "function") return undefined;
      let cancelled = false;
      (async () => {
        try {
          const data = await fetchFaithItems({ limit });
          if (!cancelled && Array.isArray(data)) setItems(data);
        } catch (err) {
          console.warn("[Sheet] load store items failed", err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [enabled, fetchFaithItems, limit]);
    return items;
  };

  Hooks.useWeaponCatalog = function useWeaponCatalog({ catalog, hasWeaponCatalog, gearSearch }) {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const fetchId = useRef(0);
    useEffect(() => {
      if (!hasWeaponCatalog || typeof catalog?.listWeapons !== "function") {
        setResults([]);
        setLoading(false);
        return undefined;
      }
      let alive = true;
      const requestId = ++fetchId.current;
      setLoading(true);
      const delay = gearSearch ? 250 : 30;
      const handle = setTimeout(async () => {
        try {
          const list = await catalog.listWeapons({
            search: gearSearch.trim(),
            limit: 40,
          });
          if (alive && fetchId.current === requestId) {
            setResults(Array.isArray(list) ? list : []);
          }
        } catch (err) {
          console.warn("[Sheet] weapon catalog lookup failed", err);
          if (alive && fetchId.current === requestId) {
            setResults([]);
          }
        } finally {
          if (alive && fetchId.current === requestId) {
            setLoading(false);
          }
        }
      }, delay);
      return () => {
        alive = false;
        clearTimeout(handle);
      };
    }, [catalog, gearSearch, hasWeaponCatalog]);
    return { results, loading };
  };

  Hooks.useSpellCatalog = function useSpellCatalog(params) {
    const {
      catalog,
      hasSpellCatalog,
      spellSearch,
      spellCatalogClass,
      spellCatalogLevel,
      spellCatalogSchool,
      spellCatalogRitual,
      spellCatalogConcentration,
      sheetClassName,
    } = params;
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const fetchId = useRef(0);
    useEffect(() => {
      if (!hasSpellCatalog || typeof catalog?.listSpells !== "function") {
        setResults([]);
        setLoading(false);
        return undefined;
      }
      let alive = true;
      const requestId = ++fetchId.current;
      setLoading(true);
      const delay = spellSearch ? 250 : 30;
      const effectiveClass =
        spellCatalogClass === "auto"
          ? sheetClassName || ""
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
          if (alive && fetchId.current === requestId) {
            setResults(Array.isArray(list) ? list : []);
          }
        } catch (err) {
          console.warn("[Sheet] spell catalog lookup failed", err);
          if (alive && fetchId.current === requestId) {
            setResults([]);
          }
        } finally {
          if (alive && fetchId.current === requestId) {
            setLoading(false);
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
      sheetClassName,
    ]);
    return { results, loading };
  };
})();
