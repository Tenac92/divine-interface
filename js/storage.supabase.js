// Remote storage adapter using Supabase
(function () {
  if (!window.SUPABASE || !window.SUPABASE.url || !window.SUPABASE.anon) {
    console.error(
      "SUPABASE config missing. Define window.SUPABASE {url, anon} before loading storage.supabase.js"
    );
    return;
  }
  const supa = () => supabase.createClient(SUPABASE.url, SUPABASE.anon);

  // ========== USERS ==========
  async function loadUsers() {
    const { data, error } = await supa()
      .from("di_users")
      .select("id, username, password, role")
      .order("username", { ascending: true });
    if (error) {
      console.error("loadUsers error:", error);
      return [];
    }
    return data || [];
  }

  async function saveUsers(users) {
    const rows = users.map((u) => ({
      id: u.id || undefined,
      username: u.username,
      password: u.password,
      role: u.role,
    }));
    const { error } = await supa()
      .from("di_users")
      .upsert(rows, { onConflict: "username" });
    if (error) console.error("saveUsers error:", error);
  }

  // ========== PROFILES ==========
  async function loadProfiles() {
    const { data, error } = await supa()
      .from("di_profiles")
      .select("owner, data");
    if (error) {
      console.error("loadProfiles error:", error);
      return {};
    }
    const map = {};
    (data || []).forEach((r) => {
      map[r.owner] = r.data;
    });
    return map;
  }

  async function saveProfiles(map) {
    const rows = Object.keys(map).map((owner) => ({ owner, data: map[owner] }));
    const { error } = await supa()
      .from("di_profiles")
      .upsert(rows, { onConflict: "owner" });
    if (error) console.error("saveProfiles error:", error);
  }

  // Single profile helpers (used by Store/Sheet)
  async function loadProfile(username) {
    const { data, error } = await supa()
      .from("di_profiles")
      .select("owner, data")
      .eq("owner", username)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      // not found is ok (PGRST116)
      console.error("loadProfile error:", error);
      return null;
    }
    return data?.data || null;
  }

  async function saveProfile(username, profile) {
    const row = { owner: username, data: profile };
    const { error } = await supa()
      .from("di_profiles")
      .upsert(row, { onConflict: "owner" });
    if (error) console.error("saveProfile error:", error);
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
