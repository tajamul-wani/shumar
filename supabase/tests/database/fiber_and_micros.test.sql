-- Dietary fiber, vitamins and minerals on foods and logs (SHU-41). Rolled back, so no test data is kept.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'user-f@test.local');

-- 1. USDA foods coverage counts
select is((select count(fiber_g_per_100g)::int from public.usda_foods), 6535, '6,535 USDA foods list dietary fiber');
select is((select count(iron_mg_per_100g)::int from public.usda_foods), 7080, '7,080 list iron');
select is((select count(potassium_mg_per_100g)::int from public.usda_foods), 6930, '6,930 list potassium');
select is((select count(zinc_mg_per_100g)::int from public.usda_foods), 6828, '6,828 list zinc');
select is((select count(vitamin_b12_mcg_per_100g)::int from public.usda_foods), 6348, '6,348 list vitamin B12');
select is((select count(vitamin_c_mg_per_100g)::int from public.usda_foods), 6629, '6,629 list vitamin C');
select is((select count(vitamin_a_mcg_per_100g)::int from public.usda_foods), 6201, '6,201 list vitamin A');
select is((select count(folate_mcg_per_100g)::int from public.usda_foods), 6228, '6,228 list folate');

-- 2. Kashmiri foods have their cited values
select results_eq(
  $$select fiber_g_per_100g, iron_mg_per_100g, potassium_mg_per_100g, folate_mcg_per_100g from public.kashmiri_foods where id = 'c0000000-0000-0000-0000-000000000001'$$,
  $$values (1.96::numeric, 3.38::numeric, 79.65::numeric, 132.61::numeric)$$,
  'Girda has its cited fiber, iron, potassium and folate'
);

select results_eq(
  $$select fiber_g_per_100g, calcium_mg_per_100g, vitamin_c_mg_per_100g, vitamin_a_mcg_per_100g from public.kashmiri_foods where id = 'c0000000-0000-0000-0000-000000000002'$$,
  $$values (3.33::numeric, 193.33::numeric, 29.42::numeric, 209.17::numeric)$$,
  'Haakh has its cited fiber, calcium, vitamin C and vitamin A'
);

select results_eq(
  $$select calcium_mg_per_100g, vitamin_d_mcg_per_100g, vitamin_b12_mcg_per_100g from public.kashmiri_foods where id = 'c0000000-0000-0000-0000-000000000003'$$,
  $$values (56.50::numeric, 0.65::numeric, 0.23::numeric)$$,
  'Nun chai has its cited calcium, vitamin D and vitamin B12'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "66666666-6666-6666-6666-666666666666"}', true);

-- 3. search_foods carries fiber and micronutrients
select is((select fiber_g_per_100g from public.search_foods('girda', 1)), 1.96::numeric, 'search returns Girda fiber');
select is((select fiber_g_per_100g from public.search_foods('haakh', 1)), 3.33::numeric, 'search returns Haakh fiber');
select is((select vitamin_b12_mcg_per_100g from public.search_foods('boiled egg', 1)), 1.11::numeric, 'search returns egg vitamin B12');

-- 4. A person's own food can store fiber and micronutrients
select lives_ok(
  $$insert into public.my_foods (name, label_basis, serving_grams, kcal, protein, carbs, fat, fiber_g, iron_mg)
    values ('Oat pack', 'serving', 40, 150, 5, 27, 2.5, 4, 1.8)$$,
  'own food accepts fiber and iron'
);
select is((select fiber_g_per_100g from public.my_foods where name = 'Oat pack'), 10.0000::numeric, 'fiber scales per 100 g');

-- 5. User logs store the full snapshot
select lives_ok(
  $$insert into public.user_logs (
      meal, food_name, food_source, quantity, unit_name, grams, kcal, protein, carbs, fat,
      fiber_g, iron_mg, potassium_mg, zinc_mg, vitamin_b12_mcg, vitamin_c_mg, vitamin_a_mcg, folate_mcg
    ) values (
      'breakfast', 'Oats', 'mine', 1, 'serving', 40, 150, 5, 27, 2.5,
      4, 1.8, 150, 1.2, 0, 0, 0, 14
    )$$,
  'user_logs accepts snapshot of fiber and micronutrients'
);

select is((select fiber_g from public.user_logs where food_name = 'Oats'), 4.00::numeric, 'log preserves fiber amount');
select is((select iron_mg from public.user_logs where food_name = 'Oats'), 1.80::numeric, 'log preserves iron amount');

select * from finish();
rollback;
