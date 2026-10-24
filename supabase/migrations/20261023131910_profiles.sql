-- One row per person: their answers to the first-run questions. Daily targets are worked out
-- from these on the device (src/lib/targets.ts), so only the answers are stored. The limits
-- match the app's checks, so a bad answer is refused here even if the app is bypassed.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- The age as given and when it was given, so the app can add the years since.
  age_years smallint not null check (age_years between 18 and 100),
  answered_at timestamptz not null default now(),
  sex text not null check (sex in ('female', 'male')),
  weight_kg numeric(6, 3) not null check (weight_kg between 30 and 300),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  height_cm numeric(5, 1) not null check (height_cm between 100 and 250),
  activity text not null check (activity in ('sedentary', 'light', 'moderate', 'very')),
  goal text not null check (goal in ('lose', 'maintain', 'gain', 'recomp')),
  -- Only a weight-loss goal has a speed, and only one of the three offered.
  loss_kg_per_week numeric(3, 2) check (loss_kg_per_week in (0.25, 0.5, 0.75)),
  constraint profiles_speed_only_when_losing check ((goal = 'lose') = (loss_kg_per_week is not null))
);

comment on table public.profiles is 'Each person''s first-run answers. Each user can only ever see and change their own row.';

alter table public.profiles enable row level security;

-- Signed-in users manage only their own row. Signed-out visitors get nothing.
revoke all on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

create policy "own profile: select" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own profile: insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own profile: update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own profile: delete" on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);
