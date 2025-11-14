-- Run this script in the Supabase SQL editor or through your migration tooling
-- to create reusable tables for the Bard class and seed them with the 2024
-- playtest information surfaced inside the Divine Interface app.

create table if not exists public.di_classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  legacy_class_id uuid null,
  source text not null default 'homebrew',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint di_classes_slug_key unique (slug)
) tablespace pg_default;

create index if not exists di_classes_slug_idx
  on public.di_classes (slug)
  tablespace pg_default;

drop trigger if exists di_classes_touch_trg on public.di_classes;

create trigger di_classes_touch_trg
  before update on public.di_classes
  for each row
  execute function touch_updated_at();

insert into public.di_classes (slug, name, legacy_class_id, source)
values
  ('bard', 'Bard', 'e99a98aa-3f4f-4e78-9750-df3eb276402b'::uuid, 'UA 2024 Bard'),
  ('fighter', 'Fighter', null, 'UA 2024 Fighter')
on conflict (slug) do update
  set name = excluded.name,
      legacy_class_id = excluded.legacy_class_id,
      source = excluded.source,
      updated_at = now();

create table if not exists public.di_class_features (
  id uuid primary key default gen_random_uuid(),
  class_slug text not null,
  class_id uuid not null,
  feature_slug text not null,
  title text not null,
  feature_type text not null default 'core',
  short_text text not null,
  detail_md text not null,
  source text not null default 'UA 2024 Bard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint di_class_features_class_feature_key unique (class_id, feature_slug),
  constraint di_class_features_class_fkey foreign key (class_id)
    references public.di_classes (id) on delete cascade
) tablespace pg_default;

create index if not exists di_class_features_class_idx
  on public.di_class_features (class_slug)
  tablespace pg_default;

drop trigger if exists di_class_features_touch_trg on public.di_class_features;

create trigger di_class_features_touch_trg
  before update on public.di_class_features
  for each row
  execute function touch_updated_at();

alter table public.di_class_features
  add column if not exists class_id uuid;

with cls as (
  select slug, id from public.di_classes
)
update public.di_class_features f
set class_id = cls.id
from cls
where f.class_slug = cls.slug
  and (f.class_id is null or f.class_id <> cls.id);

alter table public.di_class_features
  alter column class_id set not null;

alter table if exists public.di_class_features
  drop constraint if exists di_class_features_class_feature_key;

alter table public.di_class_features
  add constraint di_class_features_class_feature_key unique (class_id, feature_slug);

alter table if exists public.di_class_features
  drop constraint if exists di_class_features_class_fkey;

alter table public.di_class_features
  add constraint di_class_features_class_fkey foreign key (class_id)
    references public.di_classes (id) on delete cascade;

create index if not exists di_class_features_class_id_idx
  on public.di_class_features (class_id)
  tablespace pg_default;

create table if not exists public.di_class_progressions (
  id uuid primary key default gen_random_uuid(),
  class_slug text not null,
  class_id uuid not null,
  level smallint not null,
  proficiency_bonus smallint not null,
  bardic_die text null,
  cantrips_known smallint not null,
  prepared_spells smallint not null,
  spell_slots jsonb not null default '{}'::jsonb,
  feature_slugs text[] not null default '{}'::text[],
  notes text null,
  source text not null default 'UA 2024 Bard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint di_class_progressions_level_check check (
    level >= 1 and level <= 20
  ),
  constraint di_class_progressions_class_level_key unique (class_id, level),
  constraint di_class_progressions_class_fkey foreign key (class_id)
    references public.di_classes (id) on delete cascade
) tablespace pg_default;

create index if not exists di_class_progressions_class_idx
  on public.di_class_progressions (class_slug)
  tablespace pg_default;

drop trigger if exists di_class_progressions_touch_trg on public.di_class_progressions;

create trigger di_class_progressions_touch_trg
  before update on public.di_class_progressions
  for each row
  execute function touch_updated_at();

alter table public.di_class_progressions
  add column if not exists class_id uuid;

with cls as (
  select slug, id from public.di_classes
)
update public.di_class_progressions p
set class_id = cls.id
from cls
where p.class_slug = cls.slug
  and (p.class_id is null or p.class_id <> cls.id);

alter table public.di_class_progressions
  alter column class_id set not null;

alter table if exists public.di_class_progressions
  drop constraint if exists di_class_progressions_class_level_key;

alter table public.di_class_progressions
  add constraint di_class_progressions_class_level_key unique (class_id, level);

alter table if exists public.di_class_progressions
  drop constraint if exists di_class_progressions_class_fkey;

alter table public.di_class_progressions
  add constraint di_class_progressions_class_fkey foreign key (class_id)
    references public.di_classes (id) on delete cascade;

create index if not exists di_class_progressions_class_id_idx
  on public.di_class_progressions (class_id)
  tablespace pg_default;

create table if not exists public.di_subclasses (
  id uuid primary key default gen_random_uuid(),
  class_slug text not null,
  class_id uuid not null,
  subclass_slug text not null,
  title text not null,
  summary text not null,
  detail_md text not null,
  source text not null default 'UA 2024 Bard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint di_subclasses_class_slug_slug_key unique (class_id, subclass_slug),
  constraint di_subclasses_slug_key unique (subclass_slug),
  constraint di_subclasses_class_fkey foreign key (class_id)
    references public.di_classes (id) on delete cascade
) tablespace pg_default;

create index if not exists di_subclasses_class_idx
  on public.di_subclasses (class_slug)
  tablespace pg_default;

drop trigger if exists di_subclasses_touch_trg on public.di_subclasses;

create trigger di_subclasses_touch_trg
  before update on public.di_subclasses
  for each row
  execute function touch_updated_at();

alter table public.di_subclasses
  add column if not exists class_id uuid;

with cls as (
  select slug, id from public.di_classes
)
update public.di_subclasses s
set class_id = cls.id
from cls
where s.class_slug = cls.slug
  and (s.class_id is null or s.class_id <> cls.id);

alter table public.di_subclasses
  alter column class_id set not null;

alter table if exists public.di_subclasses
  drop constraint if exists di_subclasses_class_slug_slug_key;

alter table public.di_subclasses
  add constraint di_subclasses_class_slug_slug_key unique (class_id, subclass_slug);

alter table if exists public.di_subclasses
  drop constraint if exists di_subclasses_class_fkey;

alter table public.di_subclasses
  add constraint di_subclasses_class_fkey foreign key (class_id)
    references public.di_classes (id) on delete cascade;

create index if not exists di_subclasses_class_id_idx
  on public.di_subclasses (class_id)
  tablespace pg_default;

create table if not exists public.di_subclass_features (
  id uuid primary key default gen_random_uuid(),
  subclass_slug text not null,
  feature_slug text not null,
  title text not null,
  level smallint not null,
  short_text text not null,
  detail_md text not null,
  source text not null default 'UA 2024 Bard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint di_subclass_features_slug_key unique (subclass_slug, feature_slug),
  constraint di_subclass_features_subclass_fkey foreign key (subclass_slug)
    references public.di_subclasses (subclass_slug) on delete cascade
) tablespace pg_default;

create index if not exists di_subclass_features_slug_idx
  on public.di_subclass_features (subclass_slug, level)
  tablespace pg_default;

drop trigger if exists di_subclass_features_touch_trg on public.di_subclass_features;

create trigger di_subclass_features_touch_trg
  before update on public.di_subclass_features
  for each row
  execute function touch_updated_at();

with bard as (
  select id from public.di_classes where slug = 'bard'
),
payload(feature_slug, title, feature_type, short_text, detail_md, source) as (
  values
  (
    'bardic-inspiration',
    'Bardic Inspiration',
    'core',
    'Bonus Action to grant a Bardic Inspiration die that rescues failed d20 tests.',
    $$You use a Bonus Action to inspire a creature within 60 feet that can see or hear you. It gains one Bardic Inspiration die (d6 to start) and can hold only one die at a time. Within the next hour, when the creature fails a d20 Test, it can roll the die and add the number rolled to the d20, potentially turning the failure into a success. The die is expended only when it is rolled.

You can grant Bardic Inspiration a number of times equal to your Charisma modifier (minimum once) and regain all expended uses when you finish a Long Rest. The die becomes a d8 at level 5, a d10 at level 10, and a d12 at level 15.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'spellcasting',
    'Spellcasting',
    'core',
    'Learn Bard spells, prepare them each day, and rely on Charisma as your spellcasting ability.',
    $$**Cantrips.** You know two Bard cantrips at level 1 (Dancing Lights and Vicious Mockery are suggested). Whenever you gain a Bard level you can replace one Bard cantrip with another Bard cantrip, and you learn additional cantrips at Bard levels 4 and 10 as shown on the progression table.

**Prepared Spells.** Choose four level 1 Bard spells to prepare (Charm Person, Color Spray, Dissonant Whispers, and Healing Word are suggested). The Prepared column of the progression table shows how many Bard spells you can have prepared at each level, and they can be any combination of levels for which you have spell slots. Prepared spells earned from other Bard features never count against this number.

**Changing Prepared Spells.** Whenever you gain a Bard level you may replace one prepared spell with another Bard spell for which you have spell slots.

**Spell Slots.** The progression table tracks how many spell slots you have for each spell level. You regain all expended slots when you finish a Long Rest.

**Spellcasting Ability.** Charisma is your spellcasting ability for Bard spells, and you can use a musical instrument as your spellcasting focus.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'expertise',
    'Expertise',
    'core',
    'Double your proficiency bonus for two skills at level 2 and two more at level 9.',
    $$At Bard level 2 choose two skill proficiencies you already possess; you gain Expertise with them (double your Proficiency Bonus). Performance and Persuasion are recommended if you are proficient. At Bard level 9 you choose two additional proficient skills for Expertise.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'jack-of-all-trades',
    'Jack of All Trades',
    'core',
    'Add half your Proficiency Bonus to ability checks made without the relevant proficiency.',
    $$Whenever you make an ability check that does not already add your Proficiency Bonus, and the roll uses a skill or tool with which you lack proficiency, you add half your Proficiency Bonus (rounded down) to the check.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-selection',
    'Bard Subclass',
    'progression',
    'Choose a Bard College at level 3 to define your specialty.',
    $$When you reach Bard level 3 you join a Bard College, gaining the subclass features for that college now and again at higher Bard levels. The current playtest details the Colleges of Dance, Glamour, Lore, and Valor.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'ability-score-improvement',
    'Ability Score Improvement',
    'progression',
    'Gain a feat or increase ability scores at Bard levels 4, 8, 12, and 16.',
    $$Whenever you reach Bard levels 4, 8, 12, or 16 you gain the Ability Score Improvement feat or any other feat for which you qualify.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'font-of-inspiration',
    'Font of Inspiration',
    'core',
    'Recharge Bardic Inspiration on a Short Rest and convert spell slots into inspiration dice.',
    $$Starting at Bard level 5 you regain all expended uses of Bardic Inspiration when you finish a Short Rest. In addition, you can expend a spell slot (no action required) to regain one expended use of Bardic Inspiration.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'subclass-feature',
    'Subclass Feature',
    'progression',
    'Your Bard College grants extra features at levels 6 and 14.',
    $$Each Bard College grants additional features beyond the initial level 3 benefit. You gain a subclass feature at Bard level 6 and again at Bard level 14, as described in the entry for your chosen college.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'countercharm',
    'Countercharm',
    'core',
    'Use a Reaction to reroll failed saves against the Charmed or Frightened conditions with advantage.',
    $$At Bard level 7 when you or a creature within 30 feet fails a saving throw that would impose the Charmed or Frightened condition, you can use your Reaction to cause an immediate reroll, and the new roll has advantage.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'magical-secrets',
    'Magical Secrets',
    'core',
    'Add new spells from the Bard, Cleric, Druid, or Wizard lists whenever your prepared spell total increases.',
    $$Beginning at Bard level 10, whenever you gain Bard levels that increase the number of prepared spells shown on the progression table, any new spells you prepare can be chosen from the Bard, Cleric, Druid, or Wizard spell lists and they count as Bard spells for you. Whenever you replace a prepared Bard spell, you may replace it with a spell from those same lists.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'superior-inspiration',
    'Superior Inspiration',
    'core',
    'Regain Bardic Inspiration up to two uses when rolling initiative.',
    $$When you reach Bard level 18 and roll initiative, if you have fewer than two uses of Bardic Inspiration you regain expended uses until you have two.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'epic-boon',
    'Epic Boon',
    'feat',
    'Select an Epic Boon or any feat when you reach Bard 19.',
    $$At Bard level 19 you gain an Epic Boon feat or any other feat of your choice for which you qualify. Boon of Spell Recall is a thematic recommendation.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'words-of-creation',
    'Words of Creation',
    'capstone',
    'Always have Power Word Heal and Power Word Kill prepared and affect a second target.',
    $$At Bard level 20 you always have the Power Word Heal and Power Word Kill spells prepared. When you cast either spell, you can target a second creature within 10 feet of the first target.$$
    ,
    'UA 2024 Bard'
  )
)
insert into public.di_class_features
  (class_id, class_slug, feature_slug, title, feature_type, short_text, detail_md, source)
select
  bard.id,
  'bard',
  payload.feature_slug,
  payload.title,
  payload.feature_type,
  payload.short_text,
  payload.detail_md,
  payload.source
from bard
join payload on true
on conflict (class_id, feature_slug) do update
set
  title = excluded.title,
  feature_type = excluded.feature_type,
  short_text = excluded.short_text,
  detail_md = excluded.detail_md,
  source = excluded.source,
  updated_at = now();

with fighter as (
  select id from public.di_classes where slug = 'fighter'
),
payload(feature_slug, title, feature_type, short_text, detail_md, source) as (
  values
  (
    'fighting-style',
    'Fighting Style',
    'core',
    'Gain a Fighting Style feat of your choice and swap it on later level ups.',
    $$You have honed your martial prowess and gain a Fighting Style feat of your choice (Defense is recommended). Whenever you gain a Fighter level, you can replace the feat you chose with a different Fighting Style feat.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'second-wind',
    'Second Wind',
    'core',
    'Bonus Action to regain 1d10 + Fighter level HP multiple times per rest.',
    $$As a Bonus Action you can draw on reserves of stamina to regain hit points equal to 1d10 + your Fighter level. You can use this feature twice. You regain one expended use when you finish a Short Rest and all expended uses when you finish a Long Rest. Higher-level entries on the Fighter table increase your number of uses.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'weapon-mastery',
    'Weapon Mastery',
    'core',
    'Use mastery properties of several weapons and swap one choice after each Long Rest.',
    $$Your training lets you use the mastery property of three kinds of Simple or Martial weapons of your choice. Whenever you finish a Long Rest, you can run weapon drills and change one of those weapon choices. Higher Fighter levels increase your number of mastery options, as shown on the Fighter progression table.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'action-surge',
    'Action Surge',
    'core',
    'Take one additional non-Magic action once per rest (twice between rests at level 17).',
    $$On your turn you can push yourself beyond your limits and take one additional action, except the Magic action. After using this feature you must finish a Short or Long Rest before using it again. Starting at level 17 you can use Action Surge twice between rests, but only once per turn.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'tactical-mind',
    'Tactical Mind',
    'core',
    'Spend Second Wind to add 1d10 to a failed ability check; the die isn’t spent on another failure.',
    $$When you fail an ability check you can expend a use of Second Wind. Instead of regaining hit points you roll 1d10 and add the number rolled to the ability check, potentially turning it into a success. If the check still fails, that use of Second Wind is not expended.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'fighter-subclass',
    'Fighter Subclass',
    'progression',
    'Choose a Fighter subclass at level 3 to specialize your tactics.',
    $$At Fighter level 3 you adopt a subclass such as the Battle Master, Champion, Eldritch Knight, or Psi Warrior. You gain that subclass’s level 3 feature now and its later features when you reach the listed Fighter levels.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'ability-score-improvement',
    'Ability Score Improvement',
    'progression',
    'Gain the Ability Score Improvement feat or another feat for which you qualify.',
    $$Whenever you reach the Fighter levels noted on the class table you gain the Ability Score Improvement feat or any other feat of your choice for which you qualify.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'extra-attack',
    'Extra Attack',
    'core',
    'Attack twice whenever you take the Attack action.',
    $$Beginning at level 5 you can attack twice, instead of once, whenever you take the Attack action on your turn.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'tactical-shift',
    'Tactical Shift',
    'core',
    'Second Wind also lets you move half your speed without provoking.',
    $$Whenever you activate Second Wind with a Bonus Action, you can move up to half your Speed without provoking Opportunity Attacks.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'subclass-feature',
    'Subclass Feature',
    'progression',
    'Your Fighter subclass grants additional features at levels 7, 10, 15, and 18.',
    $$Each Fighter subclass grants more features beyond level 3. You gain your subclass features when you reach Fighter levels 7, 10, 15, and 18, as described in your chosen college.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'indomitable',
    'Indomitable',
    'core',
    'Reroll a failed save with a bonus equal to your Fighter level, more times at higher levels.',
    $$Starting at level 9 when you fail a saving throw, you can reroll it and add a bonus equal to your Fighter level. You must use the new roll. You regain use of Indomitable after a Long Rest. You can use it twice between Long Rests starting at level 13 and three times starting at level 17.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'tactical-master',
    'Tactical Master',
    'core',
    'Swap to Push, Sap, or Slow mastery on the fly when attacking.',
    $$When you attack with a weapon whose mastery property you can use, you can replace that property with the Push, Sap, or Slow property for that attack.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'two-extra-attacks',
    'Two Extra Attacks',
    'core',
    'Make three attacks when you take the Attack action.',
    $$At level 11 you can attack three times instead of once whenever you take the Attack action on your turn.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'studied-attacks',
    'Studied Attacks',
    'core',
    'Gain Advantage on your next attack against a creature you just missed.',
    $$You learn from every swing. If you make an attack roll against a creature and miss, you have Advantage on your next attack roll against that creature before the end of your next turn.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'epic-boon',
    'Epic Boon',
    'feat',
    'Select an Epic Boon or any feat when you reach Fighter 19.',
    $$At Fighter level 19 you gain an Epic Boon feat or another feat for which you qualify. Boon of Combat Prowess is recommended.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'three-extra-attacks',
    'Three Extra Attacks',
    'capstone',
    'Attack four times whenever you take the Attack action.',
    $$At level 20 you can attack four times instead of once whenever you take the Attack action on your turn.$$
    ,
    'UA 2024 Fighter'
  )
)
insert into public.di_class_features
  (class_id, class_slug, feature_slug, title, feature_type, short_text, detail_md, source)
select
  fighter.id,
  'fighter',
  payload.feature_slug,
  payload.title,
  payload.feature_type,
  payload.short_text,
  payload.detail_md,
  payload.source
from fighter
join payload on true
on conflict (class_id, feature_slug) do update
set
  title = excluded.title,
  feature_type = excluded.feature_type,
  short_text = excluded.short_text,
  detail_md = excluded.detail_md,
  source = excluded.source,
  updated_at = now();

with bard as (
  select id from public.di_classes where slug = 'bard'
),
payload(
  level,
  proficiency_bonus,
  bardic_die,
  cantrips_known,
  prepared_spells,
  spell_slots,
  feature_slugs,
  notes,
  source
) as (
  values
  (1, 2, 'd6', 2, 4, '{"1":2}'::jsonb, ARRAY['bardic-inspiration','spellcasting']::text[], null::text, 'UA 2024 Bard'),
  (2, 2, 'd6', 2, 5, '{"1":3}'::jsonb, ARRAY['expertise','jack-of-all-trades']::text[], null::text, 'UA 2024 Bard'),
  (3, 2, 'd6', 2, 6, '{"1":4,"2":2}'::jsonb, ARRAY['college-selection']::text[], null::text, 'UA 2024 Bard'),
  (4, 2, 'd6', 3, 7, '{"1":4,"2":3}'::jsonb, ARRAY['ability-score-improvement']::text[], null::text, 'UA 2024 Bard'),
  (5, 3, 'd8', 3, 9, '{"1":4,"2":3,"3":2}'::jsonb, ARRAY['font-of-inspiration']::text[], null::text, 'UA 2024 Bard'),
  (6, 3, 'd8', 3, 10, '{"1":4,"2":3,"3":3}'::jsonb, ARRAY['subclass-feature']::text[], null::text, 'UA 2024 Bard'),
  (7, 3, 'd8', 3, 11, '{"1":4,"2":3,"3":3,"4":1}'::jsonb, ARRAY['countercharm']::text[], null::text, 'UA 2024 Bard'),
  (8, 3, 'd8', 3, 12, '{"1":4,"2":3,"3":3,"4":2}'::jsonb, ARRAY['ability-score-improvement']::text[], null::text, 'UA 2024 Bard'),
  (9, 4, 'd8', 3, 14, '{"1":4,"2":3,"3":3,"4":3,"5":1}'::jsonb, ARRAY['expertise']::text[], null::text, 'UA 2024 Bard'),
  (10, 4, 'd10', 4, 15, '{"1":4,"2":3,"3":3,"4":3,"5":2}'::jsonb, ARRAY['magical-secrets']::text[], null::text, 'UA 2024 Bard'),
  (11, 4, 'd10', 4, 16, '{"1":4,"2":3,"3":3,"4":3,"5":2,"6":1}'::jsonb, ARRAY[]::text[], null::text, 'UA 2024 Bard'),
  (12, 4, 'd10', 4, 16, '{"1":4,"2":3,"3":3,"4":3,"5":2,"6":1}'::jsonb, ARRAY['ability-score-improvement']::text[], null::text, 'UA 2024 Bard'),
  (13, 5, 'd10', 4, 17, '{"1":4,"2":3,"3":3,"4":3,"5":2,"6":1,"7":1}'::jsonb, ARRAY[]::text[], null::text, 'UA 2024 Bard'),
  (14, 5, 'd10', 4, 17, '{"1":4,"2":3,"3":3,"4":3,"5":2,"6":1,"7":1}'::jsonb, ARRAY['subclass-feature']::text[], null::text, 'UA 2024 Bard'),
  (15, 5, 'd12', 4, 18, '{"1":4,"2":3,"3":3,"4":3,"5":2,"6":1,"7":1}'::jsonb, ARRAY[]::text[], null::text, 'UA 2024 Bard'),
  (16, 5, 'd12', 4, 18, '{"1":4,"2":3,"3":3,"4":3,"5":2,"6":1,"7":1}'::jsonb, ARRAY['ability-score-improvement']::text[], null::text, 'UA 2024 Bard'),
  (17, 6, 'd12', 4, 19, '{"1":4,"2":3,"3":3,"4":3,"5":2,"6":1,"7":1,"8":1,"9":1}'::jsonb, ARRAY[]::text[], null::text, 'UA 2024 Bard'),
  (18, 6, 'd12', 4, 20, '{"1":4,"2":3,"3":3,"4":3,"5":3,"6":1,"7":1,"8":1,"9":1}'::jsonb, ARRAY['superior-inspiration']::text[], null::text, 'UA 2024 Bard'),
  (19, 6, 'd12', 4, 21, '{"1":4,"2":3,"3":3,"4":3,"5":3,"6":2,"7":1,"8":1,"9":1}'::jsonb, ARRAY['epic-boon']::text[], null::text, 'UA 2024 Bard'),
  (20, 6, 'd12', 4, 22, '{"1":4,"2":3,"3":3,"4":3,"5":3,"6":2,"7":2,"8":1,"9":1}'::jsonb, ARRAY['words-of-creation']::text[], null::text, 'UA 2024 Bard')
)
insert into public.di_class_progressions
  (class_id, class_slug, level, proficiency_bonus, bardic_die, cantrips_known, prepared_spells, spell_slots, feature_slugs, notes, source)
select
  bard.id,
  'bard',
  payload.level,
  payload.proficiency_bonus,
  payload.bardic_die,
  payload.cantrips_known,
  payload.prepared_spells,
  payload.spell_slots,
  payload.feature_slugs,
  payload.notes,
  payload.source
from bard
join payload on true
on conflict (class_id, level) do update
set
  proficiency_bonus = excluded.proficiency_bonus,
  bardic_die = excluded.bardic_die,
  cantrips_known = excluded.cantrips_known,
  prepared_spells = excluded.prepared_spells,
  spell_slots = excluded.spell_slots,
  feature_slugs = excluded.feature_slugs,
  notes = excluded.notes,
  source = excluded.source,
  updated_at = now();

with fighter as (
  select id from public.di_classes where slug = 'fighter'
),
payload(
  level,
  proficiency_bonus,
  cantrips_known,
  prepared_spells,
  spell_slots,
  feature_slugs,
  source
) as (
  values
  (1, 2, 0, 0, '{"second_wind":2,"weapon_mastery":3}'::jsonb, ARRAY['fighting-style','second-wind','weapon-mastery']::text[], 'UA 2024 Fighter'),
  (2, 2, 0, 0, '{"second_wind":2,"weapon_mastery":3}'::jsonb, ARRAY['action-surge','tactical-mind']::text[], 'UA 2024 Fighter'),
  (3, 2, 0, 0, '{"second_wind":2,"weapon_mastery":3}'::jsonb, ARRAY['fighter-subclass']::text[], 'UA 2024 Fighter'),
  (4, 2, 0, 0, '{"second_wind":3,"weapon_mastery":4}'::jsonb, ARRAY['ability-score-improvement']::text[], 'UA 2024 Fighter'),
  (5, 3, 0, 0, '{"second_wind":3,"weapon_mastery":4}'::jsonb, ARRAY['extra-attack','tactical-shift']::text[], 'UA 2024 Fighter'),
  (6, 3, 0, 0, '{"second_wind":3,"weapon_mastery":4}'::jsonb, ARRAY['ability-score-improvement']::text[], 'UA 2024 Fighter'),
  (7, 3, 0, 0, '{"second_wind":3,"weapon_mastery":4}'::jsonb, ARRAY['subclass-feature']::text[], 'UA 2024 Fighter'),
  (8, 3, 0, 0, '{"second_wind":3,"weapon_mastery":4}'::jsonb, ARRAY['ability-score-improvement']::text[], 'UA 2024 Fighter'),
  (9, 4, 0, 0, '{"second_wind":3,"weapon_mastery":4}'::jsonb, ARRAY['indomitable','tactical-master']::text[], 'UA 2024 Fighter'),
  (10, 4, 0, 0, '{"second_wind":4,"weapon_mastery":5}'::jsonb, ARRAY['subclass-feature']::text[], 'UA 2024 Fighter'),
  (11, 4, 0, 0, '{"second_wind":4,"weapon_mastery":5}'::jsonb, ARRAY['two-extra-attacks']::text[], 'UA 2024 Fighter'),
  (12, 4, 0, 0, '{"second_wind":4,"weapon_mastery":5}'::jsonb, ARRAY['ability-score-improvement']::text[], 'UA 2024 Fighter'),
  (13, 5, 0, 0, '{"second_wind":4,"weapon_mastery":5}'::jsonb, ARRAY['indomitable','studied-attacks']::text[], 'UA 2024 Fighter'),
  (14, 5, 0, 0, '{"second_wind":4,"weapon_mastery":5}'::jsonb, ARRAY['ability-score-improvement']::text[], 'UA 2024 Fighter'),
  (15, 5, 0, 0, '{"second_wind":4,"weapon_mastery":5}'::jsonb, ARRAY['subclass-feature']::text[], 'UA 2024 Fighter'),
  (16, 5, 0, 0, '{"second_wind":4,"weapon_mastery":6}'::jsonb, ARRAY['ability-score-improvement']::text[], 'UA 2024 Fighter'),
  (17, 6, 0, 0, '{"second_wind":4,"weapon_mastery":6}'::jsonb, ARRAY['action-surge','indomitable']::text[], 'UA 2024 Fighter'),
  (18, 6, 0, 0, '{"second_wind":4,"weapon_mastery":6}'::jsonb, ARRAY['subclass-feature']::text[], 'UA 2024 Fighter'),
  (19, 6, 0, 0, '{"second_wind":4,"weapon_mastery":6}'::jsonb, ARRAY['epic-boon']::text[], 'UA 2024 Fighter'),
  (20, 6, 0, 0, '{"second_wind":4,"weapon_mastery":6}'::jsonb, ARRAY['three-extra-attacks']::text[], 'UA 2024 Fighter')
)
insert into public.di_class_progressions
  (class_id, class_slug, level, proficiency_bonus, bardic_die, cantrips_known, prepared_spells, spell_slots, feature_slugs, notes, source)
select
  fighter.id,
  'fighter',
  payload.level,
  payload.proficiency_bonus,
  null,
  payload.cantrips_known,
  payload.prepared_spells,
  payload.spell_slots,
  payload.feature_slugs,
  null,
  payload.source
from fighter
join payload on true
on conflict (class_id, level) do update
set
  proficiency_bonus = excluded.proficiency_bonus,
  bardic_die = excluded.bardic_die,
  cantrips_known = excluded.cantrips_known,
  prepared_spells = excluded.prepared_spells,
  spell_slots = excluded.spell_slots,
  feature_slugs = excluded.feature_slugs,
  notes = excluded.notes,
  source = excluded.source,
  updated_at = now();

with bard as (
  select id from public.di_classes where slug = 'bard'
),
payload(subclass_slug, title, summary, detail_md, source) as (
  values
  (
    'college-of-dance',
    'College of Dance',
    'Turn motion into magic with agile defense, responsive movement, and Bardic-fueled strikes.',
    $$Bards of the College of Dance believe the Words of Creation are spoken through motion. They emphasize agility, speed, and grace, channeling power through choreography to stay in step with the cosmos.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-glamour',
    'College of Glamour',
    'Fey-inspired performers who weaponize beauty and terror to command emotions.',
    $$The College of Glamour draws upon the beguiling power of the Feywild. These Bards weave wonder and dread into their performances, cloaking themselves in otherworldly majesty to sway hearts and unravel resolve.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-lore',
    'College of Lore',
    'Knowledge seekers who collect spells and secrets to expose lies and inspire change.',
    $$Lore Bards scour tomes, rites, and folk tales to catalogue every useful secret. They meet in libraries or at courts to trade discoveries, using wit to cut through deception and hubris.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-valor',
    'College of Valor',
    'Martial storytellers who inspire heroes by witnessing and relaying mighty deeds.',
    $$Valor Bards travel battlefields and great halls to chronicle heroism firsthand. Their songs bolster allies, teach tactical prowess, and keep the memory of legendary exploits alive.$$
    ,
    'UA 2024 Bard'
  )
)
insert into public.di_subclasses
  (class_id, class_slug, subclass_slug, title, summary, detail_md, source)
select
  bard.id,
  'bard',
  payload.subclass_slug,
  payload.title,
  payload.summary,
  payload.detail_md,
  payload.source
from bard
join payload on true
on conflict (class_id, subclass_slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  detail_md = excluded.detail_md,
  source = excluded.source,
  updated_at = now();

with fighter as (
  select id from public.di_classes where slug = 'fighter'
),
payload(subclass_slug, title, summary, detail_md, source) as (
  values
  (
    'battle-master',
    'Battle Master',
    'Students of battlefield control who wield maneuvers and superior dice.',
    $$Battle Masters study martial techniques handed down through generations. They blend relentless combat drills with academic study of history, theory, and the arts to outthink and outmaneuver every foe.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'champion',
    'Champion',
    'Athletic fighters who leverage raw physical excellence to strike decisive blows.',
    $$Champions pursue martial perfection through grueling training and sheer resilience. Whether in contests or on battlefields, they seek glory by landing critical hits, shrugging off danger, and inspiring others with heroic feats.$$
    ,
    'UA 2024 Fighter'
  ),
  (
    'eldritch-knight',
    'Eldritch Knight',
    'Fighters who fuse arcane study with weapon mastery.',
    $$Eldritch Knights combine the martial mastery common to all Fighters with a careful study of magic. Their spells shield them, strike distant foes, and weave seamlessly into their weapon techniques.$$
    ,
    'UA 2024 Fighter'
  )
)
insert into public.di_subclasses
  (class_id, class_slug, subclass_slug, title, summary, detail_md, source)
select
  fighter.id,
  'fighter',
  payload.subclass_slug,
  payload.title,
  payload.summary,
  payload.detail_md,
  payload.source
from fighter
join payload on true
on conflict (class_id, subclass_slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  detail_md = excluded.detail_md,
  source = excluded.source,
  updated_at = now();

insert into public.di_subclass_features
  (subclass_slug, feature_slug, title, level, short_text, detail_md, source)
values
  -- College of Dance
  (
    'college-of-dance',
    'dance-dazzling-footwork',
    'Dazzling Footwork',
    3,
    'Gain Dance Virtuoso bonuses, unarmored defense, agile strikes, and Bardic-powered damage.',
    $$While unarmored and without a shield you gain several benefits. **Dance Virtuoso** lets you move with exacting grace, **Unarmored Defense** sets your AC to 10 + Dex mod + Cha mod, **Agile Strikes** allow an Unarmed Strike whenever you expend Bardic Inspiration as part of an action, bonus action, or reaction, and **Bardic Damage** lets you use Dexterity for Unarmed Strike attacks and deal Bardic Inspiration die + Dexterity modifier bludgeoning damage without expending the die.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-dance',
    'dance-inspiring-movement',
    'Inspiring Movement',
    6,
    'Reaction to move yourself and an ally when an enemy ends its turn nearby.',
    $$When an enemy you can see ends its turn within 5 feet of an ally who is within 60 feet of you, you can use your Reaction and expend Bardic Inspiration to move up to half your speed. Roll the Bardic Inspiration die; the ally can move a number of feet equal to 5 times the roll. None of the movement provokes Opportunity Attacks.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-dance',
    'dance-tandem-footwork',
    'Tandem Footwork',
    6,
    'Spend Bardic Inspiration when rolling initiative to grant allies a bonus to their initiative.',
    $$When you roll initiative and are not incapacitated you can expend Bardic Inspiration. Roll the die and choose a number of creatures within 60 feet (including yourself) equal to your Charisma modifier (minimum one). Each chosen creature adds the number rolled to its initiative.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-dance',
    'dance-leading-evasion',
    'Leading Evasion',
    14,
    'Evasion for Dexterity saves, with the option to share the benefit with adjacent allies.',
    $$When an effect allows a Dexterity saving throw for half damage, you take no damage on a success and half on a failure. If creatures within 5 feet of you must make the same save, you can share this benefit with them. You cannot use this feature while incapacitated.$$
    ,
    'UA 2024 Bard'
  ),

  -- College of Glamour
  (
    'college-of-glamour',
    'glamour-beguiling-magic',
    'Beguiling Magic',
    3,
    'Always prepared Charm Person and Mirror Image plus a once-per-rest charm or frighten rider.',
    $$You always have Charm Person and Mirror Image prepared. Immediately after you cast an Enchantment or Illusion spell, you can force a creature within 60 feet to make a Wisdom save against your spell save DC. On a failure the target is either Charmed or Frightened (your choice) for 1 minute. It repeats the save at the end of each turn, ending the effect on a success. You regain this rider after a Long Rest or by expending a Bardic Inspiration use.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-glamour',
    'glamour-mantle-of-inspiration',
    'Mantle of Inspiration',
    3,
    'Bonus Action Bardic Inspiration that grants temp HP and reactionless movement to allies.',
    $$As a Bonus Action you expend Bardic Inspiration and roll the die. Choose creatures within 60 feet up to your Charisma modifier (minimum one). Each target gains temporary hit points equal to twice the number rolled and can use its Reaction to move up to its speed without provoking Opportunity Attacks.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-glamour',
    'glamour-mantle-of-majesty',
    'Mantle of Majesty',
    6,
    'Assume a fey visage that lets you cast Command as a Bonus Action each round.',
    $$You always have Command prepared. As a Bonus Action you cast Command without expending a spell slot, taking on an unearthly appearance for 1 minute (as though concentrating). While the effect lasts you can cast Command as a Bonus Action without expending spell slots, and creatures charmed by you automatically fail their saves. Once used, the feature recharges after a Long Rest or by expending a 3rd-level or higher spell slot.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-glamour',
    'glamour-unbreakable-majesty',
    'Unbreakable Majesty',
    14,
    'Bonus Action aura that forces attackers to succeed on a Charisma save or miss you.',
    $$As a Bonus Action you cloak yourself in majestic power for 1 minute or until you are incapacitated. Whenever a creature hits you for the first time on a turn, it must succeed on a Charisma saving throw against your spell save DC or the attack misses as the creature recoils. You can’t assume this presence again until you finish a Short or Long Rest.$$
    ,
    'UA 2024 Bard'
  ),

  -- College of Lore
  (
    'college-of-lore',
    'lore-bonus-proficiencies',
    'Bonus Proficiencies',
    3,
    'Gain proficiency in three additional skills of your choice.',
    $$At level 3 you learn three extra skills, reflecting the College of Lore’s relentless curiosity.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-lore',
    'lore-cutting-words',
    'Cutting Words',
    3,
    'Use a Reaction and Bardic Inspiration to reduce an enemy roll or damage.',
    $$When a creature you can see within 60 feet makes a damage roll or succeeds on an ability check or attack roll, you can use your Reaction to expend Bardic Inspiration. Roll the die and subtract the result from the creature’s roll, possibly turning success into failure.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-lore',
    'lore-magical-discoveries',
    'Magical Discoveries',
    6,
    'Always prepared off-list spells drawn from Cleric, Druid, or Wizard lists.',
    $$You learn two spells of your choice from the Cleric, Druid, or Wizard spell lists (or any mix). Each must be a cantrip or a spell level you can cast. You always have the chosen spells prepared, and whenever you gain a Bard level you can replace one with another spell that meets these requirements.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-lore',
    'lore-peerless-skill',
    'Peerless Skill',
    14,
    'Turn failures into successes by adding Bardic Inspiration to your own rolls.',
    $$When you make an ability check or attack roll and fail, you can expend Bardic Inspiration, rolling the die and adding it to the d20. If the roll still fails, the Bardic Inspiration use is not expended.$$
    ,
    'UA 2024 Bard'
  ),

  -- College of Valor
  (
    'college-of-valor',
    'valor-combat-inspiration',
    'Combat Inspiration',
    3,
    'Creatures can spend your Bardic Inspiration on defense or bonus damage.',
    $$A creature that holds one of your Bardic Inspiration dice can use it to boost combat rolls. **Defense:** When hit by an attack, it can use its Reaction to add the die result to its AC against that attack, possibly causing a miss. **Offense:** Immediately after hitting with an attack, it can add the roll to the damage dealt.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-valor',
    'valor-martial-training',
    'Martial Training',
    3,
    'Gain martial weapon, medium armor, and shield proficiencies; weapons can be spellcasting foci.',
    $$You gain proficiency with martial weapons, medium armor, and shields. Additionally, you can use any simple or martial weapon as a spellcasting focus for Bard spells.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-valor',
    'valor-extra-attack',
    'Extra Attack',
    6,
    'Attack twice and optionally replace one attack with a Bard cantrip.',
    $$Whenever you take the Attack action you can make two attacks instead of one. You can replace one of those attacks with the casting of a Bard cantrip that has a casting time of one action.$$
    ,
    'UA 2024 Bard'
  ),
  (
    'college-of-valor',
    'valor-battle-magic',
    'Battle Magic',
    14,
    'After casting an action spell you can make a weapon attack as a Bonus Action.',
    $$After you cast a spell with a casting time of one action, you can make one weapon attack as a Bonus Action.$$
    ,
    'UA 2024 Bard'
  )
on conflict (subclass_slug, feature_slug) do update
set
  title = excluded.title,
  level = excluded.level,
  short_text = excluded.short_text,
  detail_md = excluded.detail_md,
  source = excluded.source,
  updated_at = now();
