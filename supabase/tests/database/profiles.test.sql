-- Profile tests: each person reads and changes only their own first-run answers, signed-out
-- visitors get nothing, and answers outside the app's limits are refused.
-- Everything runs in a transaction that is rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Test fixtures (not real people)
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'user-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@test.local');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS is on for profiles');

-- Signed-out visitor
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok('select * from public.profiles', '42501', null, 'a visitor cannot read any profile');
select throws_ok(
  $$insert into public.profiles (user_id, age_years, sex, weight_kg, height_cm, activity, goal)
    values ('11111111-1111-1111-1111-111111111111', 30, 'male', 80, 175, 'light', 'maintain')$$,
  '42501', null, 'a visitor cannot add a profile');

-- User A
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.profiles (age_years, sex, weight_kg, weight_unit, height_cm, activity, goal, loss_kg_per_week)
    values (30, 'male', 79.832, 'lb', 175, 'light', 'lose', 0.5)$$,
  'a signed-in user can save their answers');
select results_eq(
  'select user_id from public.profiles',
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'the profile belongs to the signed-in user, taken from the session');
select throws_ok(
  $$insert into public.profiles (user_id, age_years, sex, weight_kg, height_cm, activity, goal)
    values ('22222222-2222-2222-2222-222222222222', 30, 'male', 80, 175, 'light', 'maintain')$$,
  '42501', null, 'a user cannot save answers for someone else');
select lives_ok(
  $$insert into public.profiles (age_years, sex, weight_kg, height_cm, activity, goal)
    values (31, 'male', 78, 175, 'moderate', 'maintain')
    on conflict (user_id) do update set
      age_years = excluded.age_years, weight_kg = excluded.weight_kg, activity = excluded.activity,
      goal = excluded.goal, loss_kg_per_week = excluded.loss_kg_per_week$$,
  'a user can replace their answers with newer ones');
select results_eq(
  'select age_years::int, weight_kg, goal, loss_kg_per_week from public.profiles',
  $$values (31, 78.000::numeric, 'maintain'::text, null::numeric)$$,
  'the newer answers replaced the old ones');

-- Answers outside the app's limits are refused, even if the app is bypassed.
select throws_ok('update public.profiles set age_years = 17', '23514', null, 'an age under 18 is refused');
select throws_ok('update public.profiles set age_years = 101', '23514', null, 'an age over 100 is refused');
select throws_ok('update public.profiles set weight_kg = 29.9', '23514', null, 'a weight under 30 kg is refused');
select throws_ok('update public.profiles set height_cm = 251', '23514', null, 'a height over 250 cm is refused');
select throws_ok($$update public.profiles set sex = 'other'$$, '23514', null, 'an unknown sex is refused');
select throws_ok($$update public.profiles set activity = 'extreme'$$, '23514', null, 'an unknown activity level is refused');
select throws_ok($$update public.profiles set weight_unit = 'stone'$$, '23514', null, 'an unknown weight unit is refused');
select throws_ok($$update public.profiles set goal = 'lose'$$, '23514', null, 'losing weight needs a speed');
select throws_ok($$update public.profiles set loss_kg_per_week = 0.5$$, '23514', null, 'a speed needs a weight-loss goal');
select throws_ok(
  $$update public.profiles set goal = 'lose', loss_kg_per_week = 1$$,
  '23514', null, 'only the three offered speeds are accepted');

-- User B
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select is_empty('select * from public.profiles', 'user B cannot see user A''s profile');
select is_empty('update public.profiles set weight_kg = 50 returning user_id', 'user B cannot change user A''s profile');
select is_empty('delete from public.profiles returning user_id', 'user B cannot delete user A''s profile');

-- Back to user A: nothing changed, and they can delete their own profile.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select results_eq('select weight_kg from public.profiles', array[78.000::numeric], 'user A''s profile is unchanged');
select isnt_empty('delete from public.profiles returning user_id', 'a user can delete their own profile');

-- Deleting an account removes its profile.
reset role;
insert into public.profiles (user_id, age_years, sex, weight_kg, height_cm, activity, goal)
values ('22222222-2222-2222-2222-222222222222', 40, 'female', 60, 160, 'sedentary', 'gain');
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is_empty(
  $$select * from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'$$,
  'deleting an account deletes its profile');

select * from finish();
rollback;
