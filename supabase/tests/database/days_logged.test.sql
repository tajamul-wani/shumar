-- The days logged count: each person counts only their own days, every day once, and visitors
-- can't call it. Rolled back, so no test data is kept. The logs are test fixtures, not food data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_function('public', 'days_logged', array[]::text[], 'days_logged() exists');
select ok(not has_function_privilege('anon', 'public.days_logged()', 'execute'), 'visitors cannot call days_logged()');
select ok(has_function_privilege('authenticated', 'public.days_logged()', 'execute'), 'signed-in people can call days_logged()');

insert into auth.users (id, email)
values
  ('44444444-4444-4444-4444-444444444444', 'user-d@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'user-e@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'user-f@test.local');

insert into public.user_logs (user_id, log_date, meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
values
  ('44444444-4444-4444-4444-444444444444', '2026-10-20', 'lunch', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('44444444-4444-4444-4444-444444444444', '2026-10-20', 'dinner', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('44444444-4444-4444-4444-444444444444', '2026-10-21', 'lunch', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('55555555-5555-5555-5555-555555555555', '2026-10-19', 'lunch', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "44444444-4444-4444-4444-444444444444"}', true);
select is(public.days_logged(), 2, 'two logs on one day and one on another count as two days');

select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "55555555-5555-5555-5555-555555555555"}', true);
select is(public.days_logged(), 1, 'another person''s days are never counted');

select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "66666666-6666-6666-6666-666666666666"}', true);
select is(public.days_logged(), 0, 'someone with no logs has 0 days');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok('select public.days_logged()', '42501', null, 'a visitor cannot call it');

select * from finish();
rollback;
