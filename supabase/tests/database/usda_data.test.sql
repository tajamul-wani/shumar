-- Checks the imported USDA data itself, so a broken import fails CI instead of reaching people.
-- The expected counts come from the import summary at the top of the data migration. When a
-- new USDA release is imported, update them together with that migration.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select is((select count(*)::int from public.usda_releases), 2, 'two USDA releases are loaded');
select is((select count(*)::int from public.usda_foods), 7117, 'every kept food is loaded');
select is((select count(*)::int from public.usda_portions), 12556, 'every kept portion is loaded');

select is(
  (select count(*)::int from public.usda_foods
   where category in ('Baby Foods', 'Fast Foods', 'Restaurant Foods', 'Meals, Entrees, and Side Dishes',
                      'American Indian/Alaska Native Foods')),
  0, 'no foods from the US-only categories');

select is(
  (select count(*)::int from public.usda_foods
   where atwater_flag is distinct from (
     abs(4 * protein_per_100g + 4 * carbs_per_100g + 9 * fat_per_100g - kcal_per_100g)
       > greatest(0.20 * kcal_per_100g, 4))),
  0, 'every Atwater flag matches the values it was worked out from');

select is(
  (select count(*)::int from public.usda_foods f
   where not exists (select 1 from public.usda_releases r where r.id = f.release_id)),
  0, 'every food points to a loaded release');

-- A few real searches, so ranking can't quietly get worse.
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}', true);

select matches((select name from public.search_foods('rice') limit 1), '^Rice, ', '"rice" finds plain rice first');
select matches((select name from public.search_foods('tea') limit 1), '^Beverages, tea, ', '"tea" finds tea, not teaseed oil');
select matches((select name from public.search_foods('spinch') limit 1), '^Spinach, ', 'the typo "spinch" finds spinach');
select matches((select name from public.search_foods('curd') limit 1), '^Yogurt, ', '"curd" finds yogurt');
select matches((select name from public.search_foods('haakh') limit 1), '^Collards, ', '"haakh" finds collard greens');
select matches((select name from public.search_foods('kong') limit 1), 'saffron', '"kong" finds saffron');
select matches((select name from public.search_foods('akhrot') limit 1), 'walnuts', '"akhrot" finds walnuts');
select is((select count(*)::int from public.search_foods('mutton') where name ilike '%goat%'), 0,
          '"mutton" means sheep in Kashmir, so it never shows goat foods such as goat cheese');

select * from finish();
rollback;
