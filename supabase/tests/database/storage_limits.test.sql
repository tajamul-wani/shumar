-- How much one person can store: each limit holds through the API, one large insert can't pass it,
-- another person is not affected, restores are not limited, and nobody can call the limit functions.
-- Rolled back, so no test data is kept. The foods are test fixtures, not food data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email)
values
  ('55555555-5555-5555-5555-555555555555', 'user-e@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'user-f@test.local');

-- A function that inserts n placeholder logs on one day, for the person signed in.
create function pg_temp.log_foods(day date, n int) returns void language sql as $$
  insert into public.user_logs (log_date, meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
  select day, 'lunch', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0 from generate_series(1, n)
$$;

-- Nobody calls the limit functions through the API
select ok(not has_function_privilege('authenticated', 'public.check_saved_meal_food_limits()', 'execute'), 'signed-in people cannot call check_saved_meal_food_limits()');
select ok(not has_function_privilege('anon', 'public.check_log_limits()', 'execute'), 'visitors cannot call check_log_limits()');
select ok(not has_function_privilege('authenticated', 'public.check_saved_meal_limits()', 'execute'), 'signed-in people cannot call check_saved_meal_limits()');

-- Person E, through the API
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "55555555-5555-5555-5555-555555555555"}', true);

select lives_ok($$select pg_temp.log_foods('2026-10-27', 100)$$, 'a day holds 100 foods');
select throws_ok($$select pg_temp.log_foods('2026-10-27', 1)$$, 'SH001', 'A day holds up to 100 foods.', 'the 101st food that day is refused');
select lives_ok($$select pg_temp.log_foods('2026-10-28', 1)$$, 'another day still takes food');
select throws_ok($$select pg_temp.log_foods('2026-10-29', 101)$$, 'SH001', null, 'one insert of 101 foods on a day is refused');
select results_eq($$select count(*)::int from public.user_logs where log_date = '2026-10-29'$$, array[0], 'and none of them go in');

-- Person F is not affected by E's full day
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "66666666-6666-6666-6666-666666666666"}', true);
select lives_ok($$select pg_temp.log_foods('2026-10-27', 1)$$, 'another person can still log on that day');

-- 50,000 foods in all. A restore loads in replica mode, which skips the limits: 49,998 more go in that way.
reset role;
set local session_replication_role = replica;
insert into public.user_logs (user_id, log_date, meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
select '55555555-5555-5555-5555-555555555555', date '2020-01-01' + (i / 90), 'lunch', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0
from generate_series(1, 49898) as i;
set local session_replication_role = origin;
select is((select count(*)::int from public.user_logs where user_id = '55555555-5555-5555-5555-555555555555'), 49999, 'a restore is not limited');

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "55555555-5555-5555-5555-555555555555"}', true);
select lives_ok($$select pg_temp.log_foods('2026-11-01', 1)$$, 'the 50,000th food goes in');
select throws_ok($$select pg_temp.log_foods('2026-11-02', 1)$$, 'SH002', 'One account holds up to 50,000 foods.', 'the 50,001st is refused');

-- 20 saved meals, 30 foods in each
select lives_ok(
  $$insert into public.saved_meals (name) select 'Meal ' || i from generate_series(1, 20) as i$$,
  'a person can keep 20 saved meals');
select throws_ok($$insert into public.saved_meals (name) values ('One more')$$, 'SH003', 'One account holds up to 20 saved meals.', 'the 21st is refused');
select lives_ok(
  $$insert into public.saved_meal_foods (saved_meal_id, position, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    select (select id from public.saved_meals where name = 'Meal 1'), i, 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0 from generate_series(1, 30) as i$$,
  'a saved meal holds 30 foods');
select throws_ok(
  $$insert into public.saved_meal_foods (saved_meal_id, position, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ((select id from public.saved_meals where name = 'Meal 1'), 31, 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0)$$,
  'SH004', 'A saved meal holds up to 30 foods.', 'the 31st food in it is refused');
select lives_ok(
  $$insert into public.saved_meal_foods (saved_meal_id, position, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ((select id from public.saved_meals where name = 'Meal 2'), 1, 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0)$$,
  'another saved meal still takes food');
select lives_ok($$delete from public.saved_meals where name = 'Meal 20'$$, 'removing a saved meal');
select lives_ok($$insert into public.saved_meals (name) values ('One more')$$, 'makes room for another');

-- 500 foods of one's own
select lives_ok(
  $$insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat, sodium_mg)
    select 'Test food ' || i, '100g', 0, 0, 0, 0, 0 from generate_series(1, 500) as i$$,
  'a person can keep 500 foods of their own');
select throws_ok(
  $$insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat, sodium_mg)
    values ('One more food', '100g', 0, 0, 0, 0, 0)$$,
  'SH005', 'One account holds up to 500 of its own foods.', 'the 501st is refused');

select * from finish();
rollback;
