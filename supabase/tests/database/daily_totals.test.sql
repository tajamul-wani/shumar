-- Daily totals for Trends: each person sees only their own days, every day summed once, nothing
-- outside the range, no range longer than 63 days, and visitors can't call it. Rolled back, so no
-- test data is kept. The logs are test fixtures, not food data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_function('public', 'daily_totals', array['date', 'date'], 'daily_totals(from, to) exists');
select ok(not has_function_privilege('anon', 'public.daily_totals(date, date)', 'execute'), 'visitors cannot call daily_totals()');
select ok(has_function_privilege('authenticated', 'public.daily_totals(date, date)', 'execute'), 'signed-in people can call daily_totals()');

insert into auth.users (id, email)
values
  ('99999999-9999-9999-9999-999999999999', 'user-i@test.local'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-j@test.local');

insert into public.user_logs (user_id, log_date, meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat, sodium_mg)
values
  ('99999999-9999-9999-9999-999999999999', '2026-10-20', 'breakfast', 'Test item', 'usda', 1, 'g', 1, 300, 20, 30, 10, 400),
  ('99999999-9999-9999-9999-999999999999', '2026-10-20', 'dinner', 'Test item', 'usda', 1, 'g', 1, 700, 40, 80, 20, 900),
  ('99999999-9999-9999-9999-999999999999', '2026-10-22', 'lunch', 'Test item', 'usda', 1, 'g', 1, 500.5, 30.25, 50, 15, 100),
  ('99999999-9999-9999-9999-999999999999', '2026-10-30', 'lunch', 'Test item', 'usda', 1, 'g', 1, 999, 1, 1, 1, 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-10-20', 'lunch', 'Test item', 'usda', 1, 'g', 1, 123, 1, 1, 1, 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "99999999-9999-9999-9999-999999999999"}', true);
select results_eq(
  $$ select log_date, kcal, protein, carbs, fat, sodium_mg, foods from public.daily_totals('2026-10-19', '2026-10-25') $$,
  $$ values ('2026-10-20'::date, 1000::numeric, 60::numeric, 110::numeric, 30::numeric, 1300::numeric, 2),
            ('2026-10-22'::date, 500.5::numeric, 30.25::numeric, 50::numeric, 15::numeric, 100::numeric, 1) $$,
  'a week sums each day once, lists only days with food, and leaves out other people and other dates'
);
select is((select count(*)::integer from public.daily_totals('2026-10-26', '2026-10-31')), 1, 'a later range finds the later day');
select is((select count(*)::integer from public.daily_totals('2026-10-01', '2026-10-31')), 3, 'a whole month works');
select is((select count(*)::integer from public.daily_totals('2026-01-01', '2026-10-31')), 0, 'a range longer than 63 days returns nothing');

select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}', true);
select results_eq(
  $$ select kcal, foods from public.daily_totals('2026-10-19', '2026-10-25') $$,
  $$ values (123::numeric, 1) $$,
  'another person sees only their own day'
);

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok('select * from public.daily_totals(''2026-10-19'', ''2026-10-25'')', '42501', null, 'a visitor cannot call it');

select * from finish();
rollback;
