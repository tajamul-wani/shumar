-- Row-level security tests: one user can never read or change another user's food logs,
-- signed-out visitors can only read the catalog, and nobody can change the catalog through the API.
-- Everything runs in a transaction that is rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Test fixtures (not real food data)
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'user-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@test.local');

insert into public.kashmiri_foods (id, name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test food', 'test', 100, 5, 10, 2, 'Test fixture, not real data');

insert into public.food_units (food_id, unit_name, grams)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'piece', 50);

-- RLS is switched on for every table
select ok((select relrowsecurity from pg_class where oid = 'public.kashmiri_foods'::regclass), 'RLS is on for kashmiri_foods');
select ok((select relrowsecurity from pg_class where oid = 'public.food_units'::regclass), 'RLS is on for food_units');
select ok((select relrowsecurity from pg_class where oid = 'public.user_logs'::regclass), 'RLS is on for user_logs');

-- Signed-out visitor
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select results_eq('select count(*)::int from public.kashmiri_foods', array[1], 'a visitor can read the food catalog');
select results_eq('select count(*)::int from public.food_units', array[1], 'a visitor can read unit weights');
select throws_ok(
  $$insert into public.kashmiri_foods (name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source)
    values ('x', 'x', 1, 0, 0, 0, 'x')$$,
  '42501', null, 'a visitor cannot add to the catalog');
select throws_ok('select * from public.user_logs', '42501', null, 'a visitor cannot read any food logs');
select throws_ok(
  $$insert into public.user_logs (user_id, meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('11111111-1111-1111-1111-111111111111', 'lunch', 'x', 'kashmiri', 1, 'g', 1, 1, 0, 0, 0)$$,
  '42501', null, 'a visitor cannot add food logs');

-- User A
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.user_logs (id, meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'lunch', 'Test food', 'kashmiri', 2, 'piece', 100, 100, 5, 10, 2)$$,
  'a signed-in user can log food');
select results_eq(
  'select user_id from public.user_logs',
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'the log belongs to the signed-in user, taken from the session');
select throws_ok(
  $$insert into public.kashmiri_foods (name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source)
    values ('x', 'x', 1, 0, 0, 0, 'x')$$,
  '42501', null, 'a signed-in user cannot add to the catalog');
select throws_ok('update public.kashmiri_foods set kcal_per_100g = 0', '42501', null, 'a signed-in user cannot change the catalog');
select throws_ok(
  $$insert into public.user_logs (user_id, meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('22222222-2222-2222-2222-222222222222', 'lunch', 'x', 'kashmiri', 1, 'g', 1, 1, 0, 0, 0)$$,
  '42501', null, 'a user cannot log food as someone else');
select throws_ok(
  $$insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('lunch', 'x', 'kashmiri', 0, 'g', 1, 1, 0, 0, 0)$$,
  '23514', null, 'a quantity of zero is rejected');
select throws_ok(
  $$insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values (' brunch', 'x', 'kashmiri', 1, 'g', 1, 1, 0, 0, 0)$$,
  '23514', null, 'a meal name with a space around it is rejected');
select lives_ok(
  $$update public.user_logs set quantity = 3 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  'a user can change their own log');

-- User B
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select results_eq('select count(*)::int from public.user_logs', array[0], 'user B cannot see user A''s logs');
select is_empty('update public.user_logs set kcal = 0 returning id', 'user B cannot change user A''s logs');
select is_empty('delete from public.user_logs returning id', 'user B cannot delete user A''s logs');

-- Back to user A
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  'select quantity::int, kcal::int from public.user_logs',
  $$values (3, 100)$$,
  'user A''s log kept their own change and was untouched by user B');
select isnt_empty('delete from public.user_logs returning id', 'a user can delete their own log');

select * from finish();
rollback;
