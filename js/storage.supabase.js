
(function(){
  const supa = () => supabase.createClient(SUPABASE.url, SUPABASE.anon);

  async function loadUsers(){
    const { data, error } = await supa().from('di_users').select('*').order('username');
    if (error) { console.error(error); return []; }
    return data.map(u => ({ id: u.id, username: u.username, password: u.password, role: u.role }));
  }
  async function saveUsers(users){
    // Upsert all (id or username unique)
    const rows = users.map(u => ({
      id: u.id || undefined,
      username: u.username, password: u.password, role: u.role
    }));
    const { error } = await supa().from('di_users').upsert(rows, { onConflict: 'username' });
    if (error) console.error(error);
  }

  async function loadProfiles(){
    const { data, error } = await supa().from('di_profiles').select('owner, data');
    if (error) { console.error(error); return {}; }
    const map = {};
    (data||[]).forEach(r => { map[r.owner] = r.data; });
    return map;
  }
  async function saveProfiles(map){
    const rows = Object.keys(map).map(owner => ({ owner, data: map[owner] }));
    const { error } = await supa().from('di_profiles').upsert(rows, { onConflict: 'owner' });
    if (error) console.error(error);
  }

  window.RemoteStore = { loadUsers, saveUsers, loadProfiles, saveProfiles };
})();
