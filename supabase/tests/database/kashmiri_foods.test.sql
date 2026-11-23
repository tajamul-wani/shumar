-- Verifies the curated Kashmiri staple food values and their household units (SHU-10).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- 1. All staple foods loaded
select is((select count(*)::int from public.kashmiri_foods), 4, 'all 4 staple Kashmiri foods are loaded');
select is((select count(*)::int from public.food_units), 8, 'all 8 household units are loaded');

-- 2. Every food has non-empty metadata and source citations
select is(
  (select count(*)::int from public.kashmiri_foods
   where length(name) = 0 or length(category) = 0 or length(source) = 0 or source_ref is null or length(source_ref) = 0),
  0, 'every food has non-empty name, category, source and source_ref'
);

-- 3. Nutrient ranges and Atwater sanity check (4*P + 4*C + 9*F within ±20% of kcal)
select is(
  (select count(*)::int from public.kashmiri_foods
   where kcal_per_100g < 0 or kcal_per_100g > 900
      or protein_per_100g < 0 or protein_per_100g > 100
      or carbs_per_100g < 0 or carbs_per_100g > 100
      or fat_per_100g < 0 or fat_per_100g > 100
      or sodium_mg_per_100g < 0),
  0, 'all nutrient numbers are within valid ranges'
);

select is(
  (select count(*)::int from public.kashmiri_foods
   where abs(4 * protein_per_100g + 4 * carbs_per_100g + 9 * fat_per_100g - kcal_per_100g)
     > greatest(0.20 * kcal_per_100g, 4)),
  0, 'all staple foods pass the Atwater sanity check'
);

-- 4. Macros fit within 100g
select is(
  (select count(*)::int from public.kashmiri_foods
   where (protein_per_100g + carbs_per_100g + fat_per_100g) > 100),
  0, 'macros sum to at most 100g per 100g'
);

-- 5. Every unit points to an existing Kashmiri food and has a positive weight
select is(
  (select count(*)::int from public.food_units u
   where not exists (select 1 from public.kashmiri_foods k where k.id = u.food_id)),
  0, 'every unit points to an existing Kashmiri food'
);

select is(
  (select count(*)::int from public.food_units
   where grams <= 0 or grams > 1000),
  0, 'unit weights are positive and within reasonable bounds'
);

-- 6. Every food has at least one household portion
select is(
  (select count(*)::int from public.kashmiri_foods k
   where not exists (select 1 from public.food_units u where u.food_id = k.id)),
  0, 'every Kashmiri food has at least one household unit'
);

-- 7. Search ranking tests: Kashmiri staple foods are returned first (tier 0)
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}', true);

select is((select name from public.search_foods('girda') limit 1), 'Girda', '"girda" finds Girda first');
select is((select name from public.search_foods('czot') limit 1), 'Girda', '"czot" finds Girda first via alias');
select is((select name from public.search_foods('haakh') limit 1), 'Haakh', '"haakh" finds Haakh first');
select is((select name from public.search_foods('nun chai') limit 1), 'Nun chai', '"nun chai" finds Nun chai first');
select is((select name from public.search_foods('noon chai') limit 1), 'Nun chai', '"noon chai" finds Nun chai first via alias');
select is((select name from public.search_foods('kehva') limit 1), 'Kehva', '"kehva" finds Kehva first');
select is((select name from public.search_foods('kahwa') limit 1), 'Kehva', '"kahwa" finds Kehva first via alias');

select * from finish();
rollback;
