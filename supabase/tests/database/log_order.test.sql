-- Foods added in one statement come back in the order they were added: each gets its own logged_at.
-- Rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'user-d@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "44444444-4444-4444-4444-444444444444"}', true);

insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
values
  ('lunch', 'first', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('lunch', 'second', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('lunch', 'third', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('lunch', 'fourth', 'usda', 1, 'g', 1, 0, 0, 0, 0),
  ('lunch', 'fifth', 'usda', 1, 'g', 1, 0, 0, 0, 0);

select is((select count(distinct logged_at)::int from public.user_logs), 5,
          'five foods added together each get their own time');
select is((select array_agg(food_name order by logged_at) from public.user_logs),
          array['first', 'second', 'third', 'fourth', 'fifth'],
          'foods added together come back in the order they were added');
select is((select array_agg(food_name order by logged_at desc) from public.user_logs),
          array['fifth', 'fourth', 'third', 'second', 'first'],
          'and in reverse when read newest first');

-- A time the app sends itself (putting a removed food back) is kept exactly as given.
insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat, logged_at)
values ('lunch', 'restored', 'usda', 1, 'g', 1, 0, 0, 0, 0, '2026-10-01T08:00:00Z');
select is((select logged_at from public.user_logs where food_name = 'restored'),
          '2026-10-01T08:00:00Z'::timestamptz, 'a time given on insert is kept');

select * from finish();
rollback;
