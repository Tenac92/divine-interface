-- Table and indexes for player profiles.
create table public.di_profiles (
  owner text not null,
  name public.citext not null default 'Unnamed'::citext,
  level integer not null default 1,
  species_id uuid null,
  class_id uuid null,
  god text null,
  fp integer not null default 0,
  locked boolean not null default false,
  inspiration boolean not null default false,
  proficiency integer not null default 2,
  ac integer not null default 10,
  hp_current integer not null default 0,
  hp_max integer not null default 0,
  hp_temp integer not null default 0,
  notes text null,
  extras jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint di_profiles_pkey1 primary key (owner),
  constraint di_profiles_owner_fkey1 foreign key (owner) references di_users (username) on delete cascade,
  constraint di_profiles_level_check check (
    (level >= 1)
    and (level <= 20)
  )
) tablespace pg_default;

create index if not exists di_profiles_name_trgm_idx
  on public.di_profiles using gin (name gin_trgm_ops)
  tablespace pg_default;

create index if not exists di_profiles_god_idx
  on public.di_profiles using btree (god)
  tablespace pg_default;

create index if not exists di_profiles_owner_idx
  on public.di_profiles using btree (owner)
  tablespace pg_default;

create index if not exists di_profiles_species_idx
  on public.di_profiles using btree (species_id)
  tablespace pg_default;

create index if not exists di_profiles_class_idx
  on public.di_profiles using btree (class_id)
  tablespace pg_default;

create trigger di_profiles_touch_trg
  before update on public.di_profiles
  for each row
  execute function touch_updated_at();

