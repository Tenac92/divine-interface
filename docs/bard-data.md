# Bard Data Tables

The Bard reference data lives in `data/di_bard_features.sql`. Running that file inside Supabase creates four reusable tables and seeds them with the full 2024 Bard progression, feature text, and college details. These tables are shaped to match the rest of the Divine Interface data model (namespaced with `di_` and using the shared `touch_updated_at()` trigger).

## Running the migration

You can load the script with either the Supabase SQL editor or a direct `psql` call:

```bash
# From the repo root, using the Supabase-provided connection string
psql "$SUPABASE_DB_URL" -f data/di_bard_features.sql
```

If you have not already added the helper function, create `touch_updated_at()` once (the default Supabase quickstart bundle includes it). The script is idempotent thanks to `ON CONFLICT` upserts.

## Table overview

- `di_classes` - lightweight registry of every supported class (slug, display name, optional `legacy_class_id` for cross-referencing). Add a row here whenever you introduce a new class.
- `di_class_features` - canonical text for each Bard feature (slug, title, short summary, markdown body, feature type) plus `class_id` that references `di_classes`.
- `di_class_progressions` - one row per Bard level with proficiency bonus, Bardic Inspiration die size, cantrips known, prepared spell count, spell slot JSON (`{"1":4,"2":3,...}`), and a `feature_slugs` array. Each row links back to `di_classes` via `class_id`.
- `di_subclasses` - metadata for the four Bard Colleges (slug, summary paragraph, markdown detail) scoped by `class_id`.
- `di_subclass_features` - level-gated features for each college, keyed by `subclass_slug` and `feature_slug`.

All tables share `created_at` / `updated_at` columns plus the `touch_updated_at` trigger so writes stay in sync with the rest of the schema.

## Example queries

Fetch the Bard progression table ready for a sheet view:

```sql
select level,
       proficiency_bonus,
       bardic_die,
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

- The script seeds `di_classes` with the Bard row (including the legacy UUID you shared). To add new classes, insert additional rows into `di_classes` and mirror the CTE pattern used for Bard when seeding the downstream tables.
- The `spell_slots` column is JSONB to make it easy to hydrate UI controls (e.g., `slotCounts = Object.entries(spell_slots)`).
- `feature_slugs` intentionally mirrors the `window.Catalog` patterns so the client can fetch the progression first, then hydrate each slug through `di_class_features`.
- College data lives separately so future classes can reuse the same schema by inserting new rows without structural changes.
