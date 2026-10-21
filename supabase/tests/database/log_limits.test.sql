-- Food logs can hold every food the search returns: names up to 200 characters and units up
-- to 60, the same limits as the USDA tables. Rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'user-c@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "33333333-3333-3333-3333-333333333333"}', true);

select lives_ok(
  $$insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('lunch', repeat('n', 200), 'usda', 1, repeat('u', 60), 1, 0, 0, 0, 0)$$,
  'a log can hold a 200-character food name and a 60-character unit');
select throws_ok(
  $$insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('lunch', repeat('n', 201), 'usda', 1, 'g', 1, 0, 0, 0, 0)$$,
  '23514', null, 'a food name over 200 characters is refused');
select throws_ok(
  $$insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('lunch', 'x', 'usda', 1, repeat('u', 61), 1, 0, 0, 0, 0)$$,
  '23514', null, 'a unit over 60 characters is refused');
select throws_ok(
  $$insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('lunch', '', 'usda', 1, 'g', 1, 0, 0, 0, 0)$$,
  '23514', null, 'an empty food name is refused');

reset role;
select ok((select coalesce(max(char_length(name)), 0) <= 200 from public.usda_foods),
          'every USDA food name fits in a log');
select ok((select coalesce(max(char_length(unit_name)), 0) <= 60 from public.usda_portions),
          'every USDA portion fits in a log');

select * from finish();
rollback;
