-- Calcium, magnesium and vitamin D on foods (SHU-39). Rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'user-e@test.local');

-- USDA foods: listed where USDA lists them, null (not listed) where it does not, never a zero.
select is((select count(calcium_mg_per_100g)::int from public.usda_foods), 7080, '7,080 USDA foods list calcium');
select is((select count(magnesium_mg_per_100g)::int from public.usda_foods), 6842, '6,842 list magnesium');
select is((select count(vitamin_d_mcg_per_100g)::int from public.usda_foods), 4710, '4,710 list vitamin D');
select is((select count(*)::int from public.usda_foods), 7117, 'every food is kept, listed or not');
select results_eq($$select calcium_mg_per_100g, magnesium_mg_per_100g, vitamin_d_mcg_per_100g from public.usda_foods where fdc_id = 173424$$,
                  $$values (50.00::numeric, 10.00::numeric, 2.20::numeric)$$, 'the hard-boiled egg has its three USDA values');
select is((select vitamin_d_mcg_per_100g from public.usda_foods where fdc_id = 172337), null, 'mustard oil has no vitamin D value, so it is not listed');

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "55555555-5555-5555-5555-555555555555"}', true);

-- Search carries the three values.
select is((select calcium_mg_per_100g from public.search_foods('boiled egg', 1)), 50.00::numeric, 'search returns calcium');
select is((select vitamin_d_mcg_per_100g from public.search_foods('mustard oil', 1)), null, 'search returns not listed as null');

-- A person's own food: sodium, calcium, magnesium and vitamin D are optional.
select lives_ok($$insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat) values ('Plain pack', '100g', 300, 20, 2, 24)$$,
                'a food needs only its name, basis, calories, protein, carbs and fat');
select is((select calcium_mg_per_100g from public.my_foods where name = 'Plain pack'), null, 'a value the pack did not list stays not listed');
select lives_ok($$insert into public.my_foods (name, label_basis, serving_grams, kcal, protein, carbs, fat, sodium_mg, calcium_mg, magnesium_mg, vitamin_d_mcg)
                  values ('Full pack', 'serving', 50, 150, 10, 1, 12, 100, 60, 10, 1)$$, 'a food can list all four optional values');
select is((select calcium_mg_per_100g from public.my_foods where name = 'Full pack'), 120.0000::numeric, 'a serving''s calcium is worked out per 100 g');
select throws_ok($$insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat, calcium_mg) values ('Bad', '100g', 1, 0, 0, 0, -1)$$,
                 '23514', null, 'a negative calcium value is refused');
select throws_ok($$insert into public.my_foods (name, label_basis, kcal, protein, carbs, fat, calcium_mg) values ('Too much', '100g', 1, 0, 0, 0, 20000)$$,
                 '23514', null, 'more calcium than a food can hold per 100 g is refused');

-- Logs keep a snapshot, null where the food had none.
select lives_ok($$insert into public.user_logs (meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat, calcium_mg, magnesium_mg, vitamin_d_mcg)
                  values ('lunch', 'Test egg', 'usda', 2, 'large', 100, 155, 12.6, 1.1, 10.6, 50, 10, 2.2)$$, 'a log keeps the three values');

select * from finish();
rollback;
