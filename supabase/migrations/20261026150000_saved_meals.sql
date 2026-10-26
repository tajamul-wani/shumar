-- Saved meals: a group of foods a person eats together ("Morning chai": 2 cups Nun Chai, 1 Girda)
-- that they can add to a meal in one tap. Each food keeps the amount and the nutrients it was saved
-- with, like a log, so a later catalog change never rewrites what the person saved.
-- Decided with Tajamul Wani on 26 October 2026 (SHU-24).
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (
    char_length(name) between 1 and 40
    and name = btrim(name)
    and name !~ '[\n\r\t]'
  ),
  created_at timestamptz not null default now(),
  constraint saved_meals_one_name_each unique (user_id, name)
);

comment on table public.saved_meals is 'A named group of foods a person adds in one tap. Each user can only ever see and change their own rows.';

create index saved_meals_user on public.saved_meals (user_id);

create table public.saved_meal_foods (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The order the foods are shown in. The app keeps a saved meal to 30 foods.
  position smallint not null check (position >= 1),
  food_name text not null check (char_length(food_name) between 1 and 200),
  food_source text not null check (food_source in ('kashmiri', 'usda')),
  food_source_id text check (char_length(food_source_id) <= 100),
  quantity numeric(8, 2) not null check (quantity > 0 and quantity <= 10000),
  unit_name text not null check (char_length(unit_name) between 1 and 60),
  grams numeric(8, 2) not null check (grams > 0 and grams <= 20000),
  kcal numeric(8, 2) not null check (kcal >= 0),
  protein numeric(7, 2) not null check (protein >= 0),
  carbs numeric(7, 2) not null check (carbs >= 0),
  fat numeric(7, 2) not null check (fat >= 0),
  sodium_mg numeric(9, 2) not null default 0 check (sodium_mg >= 0),
  constraint saved_meal_foods_one_position_each unique (saved_meal_id, position)
);

comment on table public.saved_meal_foods is 'The foods in a saved meal, with the amount and nutrients they were saved with.';

create index saved_meal_foods_meal on public.saved_meal_foods (saved_meal_id);

alter table public.saved_meals enable row level security;
alter table public.saved_meal_foods enable row level security;

-- Signed-in users read, add and delete their own saved meals, and read, add and remove their
-- foods. Nothing is changed in place: a food is removed and added again with its new amount.
-- Removing a saved meal removes its foods through the cascade. Signed-out visitors get nothing.
revoke all on public.saved_meals from anon, authenticated;
revoke all on public.saved_meal_foods from anon, authenticated;
grant select, insert, delete on public.saved_meals to authenticated;
grant select, insert, delete on public.saved_meal_foods to authenticated;

create policy "own saved meals: select" on public.saved_meals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own saved meals: insert" on public.saved_meals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own saved meals: delete" on public.saved_meals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own saved meal foods: select" on public.saved_meal_foods
  for select to authenticated using ((select auth.uid()) = user_id);
-- A food may only go into one of the person's own saved meals.
create policy "own saved meal foods: insert" on public.saved_meal_foods
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.saved_meals m
      where m.id = saved_meal_id and m.user_id = (select auth.uid())
    )
  );
create policy "own saved meal foods: delete" on public.saved_meal_foods
  for delete to authenticated using ((select auth.uid()) = user_id);
