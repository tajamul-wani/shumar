-- Shumār initial schema: the food catalog, unit weights and private food logs.
-- Every table has row-level security. Nutrient values in the catalog are stored per 100 g.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Food catalog (public, read-only for app users)
-- ---------------------------------------------------------------------------
create table public.kashmiri_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  aliases text[] not null default '{}',
  category text not null check (char_length(category) between 1 and 60),
  kcal_per_100g numeric(7, 2) not null check (kcal_per_100g between 0 and 900),
  protein_per_100g numeric(6, 2) not null check (protein_per_100g between 0 and 100),
  carbs_per_100g numeric(6, 2) not null check (carbs_per_100g between 0 and 100),
  fat_per_100g numeric(6, 2) not null check (fat_per_100g between 0 and 100),
  sodium_mg_per_100g numeric(8, 2) not null default 0 check (sodium_mg_per_100g between 0 and 40000),
  source text not null check (char_length(source) between 1 and 200),
  source_ref text check (char_length(source_ref) <= 500),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint macros_fit_in_100g check (protein_per_100g + carbs_per_100g + fat_per_100g <= 100)
);

comment on table public.kashmiri_foods is 'Curated Kashmiri foods. Values are per 100 g as eaten, and every row cites its source.';

create index kashmiri_foods_name_trgm on public.kashmiri_foods using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Household unit weights (piece, cup, katori) for catalog foods
-- ---------------------------------------------------------------------------
create table public.food_units (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.kashmiri_foods (id) on delete cascade,
  unit_name text not null check (char_length(unit_name) between 1 and 30),
  grams numeric(7, 2) not null check (grams > 0 and grams <= 5000),
  unique (food_id, unit_name)
);

comment on table public.food_units is 'Weight in grams of one household unit of a catalog food.';

create index food_units_food_id on public.food_units (food_id);

-- ---------------------------------------------------------------------------
-- Food logs (private to each user)
-- ---------------------------------------------------------------------------
create table public.user_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null default current_date,
  logged_at timestamptz not null default now(),
  meal text not null check (meal in ('breakfast', 'lunch', 'evening_tea', 'dinner', 'snack')),
  food_name text not null check (char_length(food_name) between 1 and 120),
  food_source text not null check (food_source in ('kashmiri', 'off', 'usda')),
  food_source_id text check (char_length(food_source_id) <= 100),
  quantity numeric(8, 2) not null check (quantity > 0 and quantity <= 10000),
  unit_name text not null check (char_length(unit_name) between 1 and 30),
  grams numeric(8, 2) not null check (grams > 0 and grams <= 20000),
  -- Snapshot of the nutrients at log time, so later catalog edits never rewrite history.
  kcal numeric(8, 2) not null check (kcal >= 0),
  protein numeric(7, 2) not null check (protein >= 0),
  carbs numeric(7, 2) not null check (carbs >= 0),
  fat numeric(7, 2) not null check (fat >= 0),
  sodium_mg numeric(9, 2) not null default 0 check (sodium_mg >= 0),
  created_at timestamptz not null default now()
);

comment on table public.user_logs is 'One row per logged food. Each user can only ever see and change their own rows.';

create index user_logs_user_date on public.user_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.kashmiri_foods enable row level security;
alter table public.food_units enable row level security;
alter table public.user_logs enable row level security;

-- Catalog: anyone may read; nobody may write through the API. Curators use migrations.
create policy "catalog: anyone can read" on public.kashmiri_foods
  for select to anon, authenticated using (true);
create policy "units: anyone can read" on public.food_units
  for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.kashmiri_foods from anon, authenticated;
revoke insert, update, delete, truncate on public.food_units from anon, authenticated;

-- Logs: signed-in users manage only their own rows. Signed-out visitors get nothing.
revoke all on public.user_logs from anon;

create policy "own logs: select" on public.user_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own logs: insert" on public.user_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own logs: update" on public.user_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own logs: delete" on public.user_logs
  for delete to authenticated using ((select auth.uid()) = user_id);
