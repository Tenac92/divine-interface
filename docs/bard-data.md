# Bard Data Tables

The Bard (and now Fighter) reference data lives in `data/di_bard_features.sql`. Running that file inside Supabase creates the reusable tables and seeds them with the full 2024 class progression, feature text, and subclass details. These tables are shaped to match the rest of the Divine Interface data model (namespaced with `di_` and using the shared `touch_updated_at()` trigger).

## Running the migration

You can load the script with either the Supabase SQL editor or a direct `psql` call:

```bash
# From the repo root, using the Supabase-provided connection string
psql "$SUPABASE_DB_URL" -f data/di_bard_features.sql
```

If you have not already added the helper function, create `touch_updated_at()` once (the default Supabase quickstart bundle includes it). The script is idempotent thanks to `ON CONFLICT` upserts.

## Table overview

- `di_class_features` - canonical text for each Bard/Fighter feature (slug, title, short summary, markdown body, feature type) plus `class_id` that references `public.classes`. The script looks up the Bard/Fighter rows by name, so make sure `public.classes` already contains them (use `classes_rows.sql` once).
- `di_class_progressions` - one row per level with proficiency bonus, inspiration die (if any), cantrips known, prepared spell count, `spell_slots` JSON, and the `feature_slugs` unlocked at that level. Each row links back to `public.classes` via `class_id`.
- `di_subclasses` - metadata for the colleges / fighter archetypes (slug, summary paragraph, markdown detail) scoped by `class_id`.
- `di_subclass_features` - level-gated features for each college, keyed by `subclass_slug` and `feature_slug`.

All tables share `created_at` / `updated_at` columns plus the `touch_updated_at` trigger so writes stay in sync with the rest of the schema.

## Example queries

Fetch the Bard progression table ready for a sheet view:

```sql
select level,
       proficiency_bonus,
       class_die,
       cantrips_known,
       prepared_spells,
       spell_slots,
       feature_slugs
from di_class_progressions
where class_slug = 'bard'
order by level;
```

Join level data with readable feature text:

```sql
select p.level,
       feature_slug,
       f.title,
       f.short_text
from di_class_progressions p
cross join unnest(p.feature_slugs) as feature_slug
join di_class_features f
  on f.class_slug = p.class_slug
 and f.feature_slug = feature_slug
where p.class_slug = 'bard'
order by p.level;
```

List the College of Valor features that unlock while leveling:

```sql
select level, title, short_text
from di_subclass_features
where subclass_slug = 'college-of-valor'
order by level;
```

## Integration notes

- The script depends on `public.classes` already having Bard and Fighter rows. Run `classes_rows.sql` (or otherwise insert the classes) first; the migration will then look up the IDs automatically.
- The `spell_slots` column is JSONB to make it easy to hydrate UI controls. Caster classes store literal spell-slot counts (`{"1":4,"2":3,...}`), while noncasters store other per-level metrics (for example, Fighter rows use `{"second_wind":3,"weapon_mastery":4}`).
- `feature_slugs` intentionally mirrors the `window.Catalog` patterns so the client can fetch the progression first, then hydrate each slug through `di_class_features`.
- College data lives separately so future classes can reuse the same schema by inserting new rows without structural changes.

## App integration

The character sheet now exposes a **Features** tab that calls the Supabase REST endpoints for `di_class_progressions` and `di_class_features`. When a player selects Bard or Fighter, the tab highlights the features unlocked at their current level and lets them expand the full markdown description without leaving the app.

- The Spells tab includes a "Class Snapshot" card that mirrors the `class_die`, prepared spell counts, and per-level slot totals from `di_class_progressions`, with a one-click sync back into the sheet's slot tracker.
- Starting at level 3, characters can pick from the `di_subclasses` rows for their class; the Features tab and hero editor stay in sync and render the matching `di_subclass_features` entries.
