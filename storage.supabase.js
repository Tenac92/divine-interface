// Remote storage adapter using Supabase (robust config + single client)
(function () {
  // ---- Resolve config from either shape ----
  var url =
    (window.SUPABASE && window.SUPABASE.url) ||
    (window.RUNTIME_ENV && window.RUNTIME_ENV.SUPABASE_URL) ||
    "";
  var anon =
    (window.SUPABASE && window.SUPABASE.anon) ||
    (window.RUNTIME_ENV && window.RUNTIME_ENV.SUPABASE_ANON_KEY) ||
    "";

  if (!url || !anon || !window.supabase || !window.supabase.createClient) {
    console.error(
      "[RemoteStore] Supabase not ready. Expected window.supabase SDK and config. " +
        "url:",
      url,
      " anon:",
      !!anon
    );
    return;
  }

  // ---- Singleton client (shared across app) ----
  // Reuse if some other file already created one.
  var client =
    (window.App && window.App.supabase) ||
    window.supabase.createClient(url, anon);

  // Expose on App namespace for others
  (window.App || (window.App = {})).supabase = client;

  // ========== USERS ==========
  async function loadUsers() {
    const { data, error } = await client
      .from("di_users")
      .select("id, username, password, role")
      .order("username", { ascending: true });
    if (error) {
      console.error("[RemoteStore] loadUsers error:", error);
      return [];
    }
    return data || [];
  }

  async function saveUsers(users) {
    const rows = (users || []).map((u) => ({
      id: u.id || undefined,
      username: u.username,
      password: u.password,
      role: u.role,
    }));
    const { error } = await client
      .from("di_users")
      .upsert(rows, { onConflict: "username" });
    if (error) console.error("[RemoteStore] saveUsers error:", error);
  }

  // ========== PROFILES ==========
  async function loadProfiles() {
    const { data, error } = await client
      .from("di_profiles")
      .select("owner, data");
    if (error) {
      console.error("[RemoteStore] loadProfiles error:", error);
      return {};
    }
    const map = {};
    (data || []).forEach((r) => {
      map[r.owner] = r.data;
    });
    return map;
  }

  async function saveProfiles(map) {
    const rows = Object.keys(map || {}).map((owner) => ({
      owner,
      data: map[owner],
    }));
    const { error } = await client
      .from("di_profiles")
      .upsert(rows, { onConflict: "owner" });
    if (error) console.error("[RemoteStore] saveProfiles error:", error);
  }

  // Single profile helpers (used by Store/Sheet)
  async function loadProfile(username) {
    const { data, error } = await client
      .from("di_profiles")
      .select("owner, data")
      .eq("owner", username)
      .maybeSingle();
    // PGRST116 = no rows
    if (error && error.code !== "PGRST116") {
      console.error("[RemoteStore] loadProfile error:", error);
      return null;
    }
    return data?.data || null;
  }

  async function saveProfile(username, profile) {
    const row = { owner: username, data: profile };
    const { error } = await client
      .from("di_profiles")
      .upsert(row, { onConflict: "owner" });
    if (error) console.error("[RemoteStore] saveProfile error:", error);
  }

  window.RemoteStore = {
    loadUsers,
    saveUsers,
    loadProfiles,
    saveProfiles,
    loadProfile,
    saveProfile,
  };
})();
