-- A person's own foods: private to them, checked like every other food, first in their own search
-- and never in anyone else's, and usable in logs and saved meals. Rolled back, so no test data is
-- kept. The foods and their values are test fixtures, not food data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'user-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@test.local');

select has_table('public', 'my_foods', 'my_foods exists');
select ok((select relrowsecurity from pg_class where oid = 'public.my_foods'::regclass), 'RLS is on for my_foods');
select ok(not has_function_privilege('authenticated', 'public.check_my_food_limits()', 'execute'),
          'signed-in people cannot call check_my_food_limits()');

-- A signed-out visitor
set local role anon;
select throws_ok('select count(*) from public.my_foods', '42501', null, 'a visitor cannot read anyone''s foods');
reset role;

-- Person A adds foods from their labels
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}', true);

select lives_ok(
  $$insert into public.my_foods (id, name, brand, label_basis, kcal, protein, carbs, fat, sodium_mg)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kxtest paneer', 'Kxbrand', '100g', 300, 20, 2, 24, 20)$$,
  'a person can add a food from its label, per 100 g');
select results_eq('select user_id from public.my_foods', array['11111111-1111-1111-1111-111111111111'::uuid],
                  'the food belongs to the signed-in person, taken from the session');
select lives_ok(
  $$insert into public.my_foods (id, name, label_basis, serving_grams, kcal, protein, carbs, fat, sodium_mg)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Kxtest crackers', 'serving', 25, 120, 2, 16, 5, 200)$$,
  'or per serving, with the serving''s grams');
select is(
  (select array[kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, sodium_mg_per_100g]
   from public.my_foods where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  array[480, 8, 64, 20, 800]::numeric[],
  'values per serving are worked out per 100 g');
select is((select display_name from public.my_foods where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
          'Kxtest paneer (Kxbrand)', 'the brand follows the name');
select throws_ok(
  $$insert into public.my_foods (name, label_basis, serving_grams, kcal, protein, carbs, fat, sodium_mg)
    values ('Kxtest a', '100g', 30, 1, 0, 0, 0, 0)$$,
  '23514', null, 'a serving size only goes with values per serving');
select throws_ok(
  $$insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat, sodium_mg)
    values ('Kxtest b', 'serving', 1, 0, 0, 0, 0)$$,
  '23514', null, 'values per serving need the serving''s grams');
select throws_ok(
  $$insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat, sodium_mg)
    values ('Kxtest c', '100g', 1200, 0, 0, 0, 0)$$,
  '23514', null, 'more than 1,000 kcal per 100 g is refused');
select throws_ok(
  $$insert into public.my_foods (name, label_basis, serving_grams, kcal, protein, carbs, fat, sodium_mg)
    values ('Kxtest d', 'serving', 10, 50, 8, 5, 0, 0)$$,
  '23514', null, 'protein, carbs and fat cannot weigh more than the food');
select throws_ok(
  $$insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat, sodium_mg)
    values (' Kxtest e', '100g', 1, 0, 0, 0, 0)$$,
  '23514', null, 'a name with a space around it is refused');
select throws_ok(
  $$insert into public.my_foods (name, brand, label_basis, kcal, protein, carbs, fat, sodium_mg)
    values ('KXTEST PANEER', 'kxbrand', '100g', 1, 0, 0, 0, 0)$$,
  '23505', null, 'the same name and brand twice is refused, whatever the letter case');
select lives_ok(
  $$insert into public.my_foods (name, brand, label_basis, kcal, protein, carbs, fat, sodium_mg)
    values ('Kxtest paneer', 'Otherbrand', '100g', 1, 0, 0, 0, 0)$$,
  'the same name with another brand is fine');
select throws_ok(
  $$insert into public.my_foods (user_id, name, label_basis, kcal, protein, carbs, fat, sodium_mg)
    values ('22222222-2222-2222-2222-222222222222', 'Kxtest f', '100g', 1, 0, 0, 0, 0)$$,
  '42501', null, 'they cannot add a food as someone else');
select lives_ok($$update public.my_foods set kcal = 290 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
                'they can change their food');
select is((select kcal_per_100g from public.my_foods where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 290::numeric,
          'and its values per 100 g follow');

-- Their search. The last food's calories are far off its protein, carbs and fat.
insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat, sodium_mg)
values ('Kxtest odd', '100g', 50, 20, 20, 10, 0);

select is((select source from public.search_foods('kxtest paneer') limit 1), 'mine',
          'their own food comes first in their search');
select is((select units from public.search_foods('kxtest crackers') where source = 'mine' limit 1),
          '[{"name": "1 serving", "grams": 25}]'::jsonb, 'a food with a serving has it as a unit');
select is((select flagged from public.search_foods('kxtest odd') where source = 'mine' limit 1), true,
          'a food whose calories don''t match its protein, carbs and fat is marked');

-- Their logs and saved meals take it
select lives_ok(
  $$insert into public.user_logs (meal, food_name, food_source, food_source_id, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('lunch', 'Kxtest paneer (Kxbrand)', 'mine', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'g', 100, 290, 20, 2, 24)$$,
  'a food of one''s own can be logged');
insert into public.saved_meals (id, name) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Kxtest meal');
select lives_ok(
  $$insert into public.saved_meal_foods (saved_meal_id, position, food_name, food_source, food_source_id, quantity, unit_name, grams, kcal, protein, carbs, fat)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 'Kxtest paneer (Kxbrand)', 'mine', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'g', 100, 290, 20, 2, 24)$$,
  'and put in a saved meal');

-- Person B
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "22222222-2222-2222-2222-222222222222"}', true);

select results_eq('select count(*)::int from public.my_foods', array[0], 'another person cannot see them');
select is((select count(*)::int from public.search_foods('kxtest') where source = 'mine'), 0,
          'or find them in search');
select results_eq(
  $$with changed as (update public.my_foods set kcal = 1 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning 1)
    select count(*)::int from changed$$,
  array[0], 'or change them');
select results_eq(
  $$with gone as (delete from public.my_foods where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning 1)
    select count(*)::int from gone$$,
  array[0], 'or remove them');

-- Person A removes a food; what they logged of it stays, with the values it was logged with
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}', true);
select lives_ok($$delete from public.my_foods where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
                'they can remove their own food');
select is((select count(*)::int from public.user_logs where food_source = 'mine'), 1,
          'and what they logged of it stays');

select * from finish();
rollback;
