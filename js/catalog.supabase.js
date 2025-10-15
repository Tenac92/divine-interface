// js/catalog.supabase.js
// Tiny catalog API: reads Weapons/Spells/Species/Classes via Supabase
(function () {
  if (!window.SUPABASE) {
    console.error("SUPABASE config missing");
    return;
  }
  const db = () => supabase.createClient(SUPABASE.url, SUPABASE.anon);

  async function listWeapons(q = {}) {
    // q: {search, category, mastery, limit}
    let req = db()
      .from("weapons")
      .select(
        "id,name,category,weapon_group,damage_dice,damage_type,properties,mastery,weight,cost_gp,range_normal,range_long"
      )
      .limit(q.limit || 100);
    if (q.category) req = req.eq("category", q.category);
    if (q.mastery) req = req.eq("mastery", q.mastery);
    if (q.search) req = req.textSearch("tsv", q.search);
    const { data, error } = await req;
    if (error) {
      console.error("listWeapons", error);
      return [];
    }
    return data || [];
  }

  async function listSpells(q = {}) {
    // q: {level, school, className, search, limit}
    let req = db()
      .from("spells")
      .select(
        "id,name,level,school,casting_time,range,components,materials,duration,concentration,ritual,classes,lists,text_md"
      )
      .order("level")
      .order("name")
      .limit(q.limit || 100);
    if (Number.isFinite(q.level)) req = req.eq("level", q.level);
    if (q.school) req = req.eq("school", q.school);
    if (q.className) req = req.contains("classes", [q.className]);
    if (q.search) req = req.textSearch("tsv", q.search);
    const { data, error } = await req;
    if (error) {
      console.error("listSpells", error);
      return [];
    }
    return data || [];
  }

  async function listSpecies() {
    const { data, error } = await db()
      .from("species")
      .select("id,name,size,speed,traits")
      .order("name");
    if (error) {
      console.error("listSpecies", error);
      return [];
    }
    return data || [];
  }

  async function listClasses() {
    const { data, error } = await db()
      .from("classes")
      .select(
        "id,name,hit_die,primary_ability,saves,armor_profs,weapon_profs,tool_profs,skills_pick,skills_list,spellcasting,features"
      )
      .order("name");
    if (error) {
      console.error("listClasses", error);
      return [];
    }
    return data || [];
  }

  window.CatalogAPI = { listWeapons, listSpells, listSpecies, listClasses };
})();
