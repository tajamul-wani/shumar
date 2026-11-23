-- The foods people eat every day come first in search, as eaten (SHU-39). Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "22222222-2222-2222-2222-222222222222"}', true);

-- The first food, by USDA ID, for each search people type.
select is((select source_id from public.search_foods('lentils cooked', 1)), '172421', '"lentils cooked" starts with boiled lentils, not sprouted');
select is((select source_id from public.search_foods('cooked lentils', 1)), '172421', '"cooked lentils" starts with boiled lentils');
select is((select source_id from public.search_foods('dal cooked', 1)), '172421', '"dal cooked" starts with boiled lentils');
select is((select source_id from public.search_foods('lentils', 1)), '172421', '"lentils" starts with boiled lentils');
select is((select count(*)::int from public.search_foods('lentils', 4) where name ilike '%sprouted%'), 0, 'sprouted lentils are not in the first four for "lentils"');
select is((select source_id from public.search_foods('rice', 1)), '169757', '"rice" starts with long-grain white, cooked');
select is((select source_id from public.search_foods('rice', 2) offset 1 limit 1), '168930', '"rice" has medium-grain white, cooked, second');
select is((select source_id from public.search_foods('white rice', 1)), '169757', '"white rice" starts with long-grain white, cooked');
select is((select source_id from public.search_foods('white rice', 2) offset 1 limit 1), '168930', '"white rice" has medium-grain white, cooked, second');
select is((select source_id from public.search_foods('white rice cooked', 1)), '169757', '"white rice cooked" starts with long-grain white, cooked');
select is((select source_id from public.search_foods('white rice cooked', 2) offset 1 limit 1), '168930', '"white rice cooked" has medium-grain, cooked, second');
select is((select source_id from public.search_foods('potato', 1)), '170438', '"potato" starts with boiled potato');
select is((select source_id from public.search_foods('potatoes', 1)), '170438', '"potatoes" starts with boiled potato');
select is((select source_id from public.search_foods('potatoes', 2) offset 1 limit 1), '170026', 'raw potato is second for "potatoes"');
select is((select source_id from public.search_foods('chicken', 1)), '171077', '"chicken" starts with the broiler breast');
select is((select source_id from public.search_foods('chicken breast', 1)), '171077', '"chicken breast" starts with the broiler breast, raw');
select is((select source_id from public.search_foods('chicken breast', 2) offset 1 limit 1), '171477', 'the cooked breast is second');
select is((select source_id from public.search_foods('bread', 1)), '174924', '"bread" starts with commercial white bread');
select is((select source_id from public.search_foods('white bread', 1)), '174924', '"white bread" starts with commercial white bread');
select is((select source_id from public.search_foods('oil', 1)), '172337', '"oil" starts with mustard oil');
select is((select source_id from public.search_foods('cooking oil', 1)), '172337', '"cooking oil" starts with mustard oil');
select is((select source_id from public.search_foods('mustard oil', 1)), '172337', '"mustard oil" is mustard oil');
select is((select source_id from public.search_foods('boiled eggs', 1)), '173424', '"boiled eggs" starts with the hard-boiled egg');
select is((select source_id from public.search_foods('hard boiled egg', 1)), '173424', '"hard boiled egg" starts with the hard-boiled egg');
select is((select source_id from public.search_foods('omelette', 1)), '172185', '"omelette" is the omelet');
select is((select source_id from public.search_foods('banana', 1)), '1105314', '"banana" starts with ripe and slightly ripe raw banana');
select is((select source_id from public.search_foods('bananas', 1)), '1105314', '"bananas" starts with ripe and slightly ripe raw banana');
select is((select source_id from public.search_foods('milk', 1)), '171265', '"milk" starts with whole milk');

-- Every pick this migration adds names a food that is loaded.
reset role;
select is((select count(*)::int from public.search_picks p where not exists (select 1 from public.usda_foods f where f.fdc_id = p.fdc_id)), 0,
          'every pick names a loaded food');
select is((select count(*)::int from public.search_picks where term in ('lentils cooked', 'white rice cooked', 'oil')), 10, 'the new terms have their foods (2 lentils, 3 rice and 5 oils)');

select * from finish();
rollback;
