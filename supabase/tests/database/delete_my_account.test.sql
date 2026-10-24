-- Deleting an account: the caller's account, profile and logs go, nobody else's do, and visitors
-- can't call it. Rolled back, so no test data is kept. The logs are test fixtures, not food data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_function('public', 'delete_my_account', array[]::text[], 'delete_my_account() exists');
select ok(not has_function_privilege('anon', 'public.delete_my_account()', 'execute'), 'visitors cannot call delete_my_account()');
select ok(has_function_privilege('authenticated', 'public.delete_my_account()', 'execute'), 'signed-in people can call delete_my_account()');

insert into auth.users (id, email)
values
  ('77777777-7777-7777-7777-777777777777', 'user-g@test.local'),
  ('88888888-8888-8888-8888-888888888888', 'user-h@test.local');

insert into public.profiles (user_id, age_years, sex, weight_kg, height_cm, activity, goal)
values
  ('77777777-7777-7777-7777-777777777777', 30, 'male', 80, 175, 'light', 'maintain'),
  ('88888888-8888-8888-8888-888888888888', 30, 'female', 60, 160, 'light', 'maintain');

insert into public.user_logs (user_id, log_date, meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
values
  ('77777777-7777-7777-7777-777777777777', '2026-10-20', 'lunch', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('77777777-7777-7777-7777-777777777777', '2026-10-21', 'dinner', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('88888888-8888-8888-8888-888888888888', '2026-10-20', 'lunch', 'Test item', 'usda', 1, 'g', 1, 0, 0, 0, 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "77777777-7777-7777-7777-777777777777"}', true);
select lives_ok('select public.delete_my_account()', 'a signed-in person can delete their own account');

reset role;
select is((select count(*)::integer from auth.users where id = '77777777-7777-7777-7777-777777777777'), 0, 'their account is gone');
select is((select count(*)::integer from public.profiles where user_id = '77777777-7777-7777-7777-777777777777'), 0, 'their profile is gone');
select is((select count(*)::integer from public.user_logs where user_id = '77777777-7777-7777-7777-777777777777'), 0, 'their logs are gone');
select is((select count(*)::integer from auth.users where id = '88888888-8888-8888-8888-888888888888'), 1, 'another person''s account stays');
select is((select count(*)::integer from public.user_logs where user_id = '88888888-8888-8888-8888-888888888888'), 1, 'another person''s logs stay');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok('select public.delete_my_account()', '42501', null, 'a visitor cannot call it');

select * from finish();
rollback;
