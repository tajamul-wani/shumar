-- Saved meals: a person sees and changes only their own, visitors see nothing, and the limits
-- hold. Rolled back, so no test data is kept. The foods are test fixtures, not food data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'user-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@test.local');

select ok((select relrowsecurity from pg_class where oid = 'public.saved_meals'::regclass), 'RLS is on for saved_meals');
select ok((select relrowsecurity from pg_class where oid = 'public.saved_meal_foods'::regclass), 'RLS is on for saved_meal_foods');

-- User A saves a meal with two foods
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}', true);

select lives_ok(
  $$insert into public.saved_meals (id, name) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Morning chai')$$,
  'a signed-in person can save a meal');
select results_eq(
  'select user_id from public.saved_meals',
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'the saved meal belongs to the signed-in person, taken from the session');
select lives_ok(
  $$insert into public.saved_meal_foods (saved_meal_id, position, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 'Test tea', 'kashmiri', 2, 'cup', 300, 90, 2, 10, 4),
           ('cccccccc-cccc-cccc-cccc-cccccccccccc', 2, 'Test bread', 'kashmiri', 1, 'piece', 90, 320, 10, 58, 4)$$,
  'they can put foods in it');
select throws_ok(
  $$insert into public.saved_meals (user_id, name) values ('22222222-2222-2222-2222-222222222222', 'x')$$,
  '42501', null, 'they cannot save a meal as someone else');
select throws_ok(
  $$insert into public.saved_meals (name) values ('Morning chai')$$,
  '23505', null, 'two saved meals cannot share a name');
select throws_ok(
  $$insert into public.saved_meals (name) values (repeat('x', 41))$$,
  '23514', null, 'a name of 41 characters is refused');
select throws_ok(
  $$insert into public.saved_meals (name) values (' Chai')$$,
  '23514', null, 'a name with a space around it is refused');
select throws_ok(
  $$insert into public.saved_meal_foods (saved_meal_id, position, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 0, 'x', 'usda', 1, 'g', 1, 0, 0, 0, 0)$$,
  '23514', null, 'a food needs a place in the meal');
select throws_ok(
  $$update public.saved_meals set name = 'Other' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  '42501', null, 'a saved meal is not changed in place');
select throws_ok(
  $$update public.saved_meal_foods set quantity = 3 where saved_meal_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  '42501', null, 'nor is a food in it');

-- User B
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "22222222-2222-2222-2222-222222222222"}', true);

select results_eq('select count(*)::int from public.saved_meals', array[0], 'another person cannot see the saved meal');
select results_eq('select count(*)::int from public.saved_meal_foods', array[0], 'another person cannot see its foods');
select throws_ok(
  $$insert into public.saved_meal_foods (saved_meal_id, position, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 3, 'x', 'usda', 1, 'g', 1, 0, 0, 0, 0)$$,
  '42501', null, 'another person cannot put a food in it');
select lives_ok(
  $$delete from public.saved_meals where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    delete from public.saved_meal_foods where saved_meal_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  'another person''s deletes run');
reset role;
select results_eq('select count(*)::int from public.saved_meals', array[1], 'but remove no meal');
select results_eq('select count(*)::int from public.saved_meal_foods', array[2], 'and no food');

-- Signed-out visitor
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok('select * from public.saved_meals', '42501', null, 'a visitor cannot read saved meals');
select throws_ok('select * from public.saved_meal_foods', '42501', null, 'a visitor cannot read their foods');

-- User A removes one food, then the saved meal, and its other food goes with it
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}', true);
select lives_ok(
  $$delete from public.saved_meal_foods where saved_meal_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and position = 2$$,
  'the person can remove a food from their saved meal');
select results_eq('select count(*)::int from public.saved_meal_foods', array[1], 'and the other food stays');
select lives_ok(
  $$delete from public.saved_meals where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  'the person can remove their saved meal');
reset role;
select results_eq('select count(*)::int from public.saved_meal_foods', array[0], 'its last food is removed with it');

select * from finish();
rollback;
