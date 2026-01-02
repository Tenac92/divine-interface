(function () {
  const AppNS = (window.App = window.App || {});

  const LIST_KEY = "di.maps.list.v1";
  const ACTIVE_KEY = "di.maps.active.v1";
  const DEFAULT_KEY = "di.maps.default.v1";
  const DATA_PREFIX = "di.map.data.v1.";
  const REMOTE_TABLE = "di_maps";
  const REMOTE_BUCKET = "maps";

  const DEFAULT_MAP = {
    id: "builtin-seraphin",
    name: "Seraphin Basin",
    source: "builtin",
    url: "data/seraphin_basin_improved.json",
    updatedAt: "2025-12-30",
    size: null,
  };

  function readListRaw() {
    try {
      const raw = JSON.parse(localStorage.getItem(LIST_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function normalizeList(list) {
    const map = new Map();
    list.forEach((entry) => {
      if (entry && entry.id) {
        map.set(entry.id, entry);
      }
    });
    if (!map.has(DEFAULT_MAP.id)) {
      map.set(DEFAULT_MAP.id, { ...DEFAULT_MAP });
    }
    return Array.from(map.values());
  }

  function writeList(list) {
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
  }

  function listMaps() {
    return normalizeList(readListRaw());
  }

  function getSupabase() {
    return (AppNS && AppNS.supabase) || null;
  }

  function canUseRemote(supa) {
    return !!(supa && supa.from && supa.storage);
  }

  function makeId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `map-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  function mergeRemoteList(remoteEntries) {
    const existing = normalizeList(readListRaw()).filter(
      (entry) => entry.source !== "supabase"
    );
    const map = new Map();
    existing.forEach((entry) => map.set(entry.id, entry));
    remoteEntries.forEach((entry) => map.set(entry.id, entry));
    return normalizeList(Array.from(map.values()));
  }

  async function refreshRemoteList() {
    const supa = getSupabase();
    if (!canUseRemote(supa)) return listMaps();
    const { data, error } = await supa
      .from(REMOTE_TABLE)
      .select("id, name, storage_path, size, updated_at, created_at, is_default")
      .order("name", { ascending: true });
    if (error) {
      console.warn("[MapStore] refreshRemoteList error:", error);
      return listMaps();
    }
    const remoteEntries = (data || []).map((row) => ({
      id: row.id,
      name: row.name || row.id,
      source: "supabase",
      storagePath: row.storage_path,
      updatedAt: row.updated_at || row.created_at || null,
      size: typeof row.size === "number" ? row.size : null,
      isDefault: !!row.is_default,
    }));
    const nextList = mergeRemoteList(remoteEntries);
    writeList(nextList);
    const remoteDefault = remoteEntries.find((entry) => entry.isDefault);
    if (remoteDefault) {
      localStorage.setItem(DEFAULT_KEY, remoteDefault.id);
    }
    return nextList;
  }

  function getDefaultMapId() {
    const list = listMaps();
    const stored = localStorage.getItem(DEFAULT_KEY) || DEFAULT_MAP.id;
    return list.some((m) => m.id === stored) ? stored : DEFAULT_MAP.id;
  }

  async function setDefaultMap(id) {
    localStorage.setItem(DEFAULT_KEY, id);
    const supa = getSupabase();
    if (canUseRemote(supa)) {
      const { error: resetError } = await supa
        .from(REMOTE_TABLE)
        .update({ is_default: false })
        .neq("id", id);
      if (resetError) throw resetError;
      const { error: setError } = await supa
        .from(REMOTE_TABLE)
        .update({ is_default: true })
        .eq("id", id);
      if (setError) throw setError;
    }
    return getDefaultMapId();
  }

  function getActiveMapId() {
    const list = listMaps();
    const stored = localStorage.getItem(ACTIVE_KEY) || "";
    if (stored && list.some((m) => m.id === stored)) return stored;
    return getDefaultMapId();
  }

  function setActiveMapId(id) {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function getMapEntry(id) {
    return listMaps().find((m) => m.id === id) || null;
  }

  function validateMap(raw) {
    if (!raw || !Array.isArray(raw.features)) {
      throw new Error("Invalid map JSON (expected features array).");
    }
    return raw;
  }

  function guessMapName(raw, fallback) {
    const values = Array.isArray(raw.features)
      ? raw.features.find((f) => f && f.id === "values")
      : null;
    return (
      (values && typeof values.name === "string" && values.name.trim()) ||
      fallback ||
      "Untitled map"
    );
  }

  async function loadMap(id) {
    const entry = getMapEntry(id);
    if (!entry) throw new Error("Map not found.");
    if (entry.source === "builtin") {
      const res = await fetch(entry.url);
      if (!res.ok) throw new Error("Map JSON not found.");
      const raw = await res.json();
      return { entry, raw: validateMap(raw) };
    }
    if (entry.source === "local") {
      const rawText = localStorage.getItem(DATA_PREFIX + entry.id);
      if (!rawText) throw new Error("Map data missing.");
      return { entry, raw: validateMap(JSON.parse(rawText)) };
    }
    if (entry.source === "supabase") {
      const supa = getSupabase();
      if (!canUseRemote(supa)) throw new Error("Supabase not available.");
      const { data, error } = await supa
        .storage
        .from(REMOTE_BUCKET)
        .download(entry.storagePath);
      if (error) throw error;
      const text = await data.text();
      return { entry, raw: validateMap(JSON.parse(text)) };
    }
    throw new Error("Unsupported map source.");
  }

  function addLocalMap(raw, name, size) {
    const id = `local-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const entry = {
      id,
      name: guessMapName(raw, name),
      source: "local",
      updatedAt: new Date().toISOString(),
      size: typeof size === "number" ? size : null,
    };
    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(raw));
    const list = normalizeList(readListRaw());
    list.push(entry);
    writeList(list);
    return entry;
  }

  async function importMapFile(file, nameOverride) {
    if (!file) throw new Error("Choose a JSON file.");
    const supa = getSupabase();
    const text = await file.text();
    const raw = validateMap(JSON.parse(text));
    if (canUseRemote(supa)) {
      return uploadRemoteMap(raw, text, file, nameOverride);
    }
    return addLocalMap(raw, nameOverride || file.name, file.size);
  }

  async function updateMapName(id, name) {
    const list = normalizeList(readListRaw());
    const trimmed = String(name || "").trim();
    const next = list.map((entry) => {
      if (entry.id !== id) return entry;
      return { ...entry, name: trimmed || entry.name };
    });
    writeList(next);
    const entry = next.find((item) => item.id === id);
    if (entry && entry.source === "supabase") {
      const supa = getSupabase();
      if (canUseRemote(supa)) {
        const { error } = await supa
          .from(REMOTE_TABLE)
          .update({ name: entry.name, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
    }
    return getMapEntry(id);
  }

  async function removeMap(id) {
    if (!id || id === DEFAULT_MAP.id) return;
    const entry = getMapEntry(id);
    const list = normalizeList(readListRaw()).filter((m) => m.id !== id);
    writeList(list);
    if (entry && entry.source === "supabase") {
      const supa = getSupabase();
      if (canUseRemote(supa)) {
        const { error: deleteError } = await supa
          .from(REMOTE_TABLE)
          .delete()
          .eq("id", id);
        if (deleteError) throw deleteError;
        if (entry.storagePath) {
          await supa.storage.from(REMOTE_BUCKET).remove([entry.storagePath]);
        }
      }
    } else {
      localStorage.removeItem(DATA_PREFIX + id);
    }
    if (getDefaultMapId() === id) {
      await setDefaultMap(DEFAULT_MAP.id);
    }
    if (getActiveMapId() === id) {
      setActiveMapId(getDefaultMapId());
    }
  }

  async function uploadRemoteMap(raw, rawText, file, nameOverride) {
    const supa = getSupabase();
    if (!canUseRemote(supa)) {
      return addLocalMap(raw, nameOverride || file.name, file.size);
    }
    const id = makeId();
    const storagePath = `library/${id}.json`;
    const body = new Blob([rawText], { type: "application/json" });
    const { error: uploadError } = await supa
      .storage
      .from(REMOTE_BUCKET)
      .upload(storagePath, body, {
        contentType: "application/json",
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const entryName = guessMapName(raw, nameOverride || file.name);
    const row = {
      id,
      name: entryName,
      storage_path: storagePath,
      size: file.size || rawText.length,
      updated_at: new Date().toISOString(),
    };
    const { error: insertError } = await supa.from(REMOTE_TABLE).insert(row);
    if (insertError) {
      await supa.storage.from(REMOTE_BUCKET).remove([storagePath]);
      throw insertError;
    }
    const entry = {
      id,
      name: entryName,
      source: "supabase",
      storagePath,
      updatedAt: row.updated_at,
      size: row.size,
    };
    const nextList = mergeRemoteList([entry]);
    writeList(nextList);
    return entry;
  }

  AppNS.MapStore = {
    listMaps,
    refreshRemoteList,
    getDefaultMapId,
    setDefaultMap,
    getActiveMapId,
    setActiveMapId,
    loadMap,
    importMapFile,
    updateMapName,
    removeMap,
    getMapEntry,
  };
})();
