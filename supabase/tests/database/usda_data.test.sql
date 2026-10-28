-- Checks the imported USDA data itself, so a broken import fails CI instead of reaching people.
-- The expected counts come from the import summary at the top of the data migration. When a
-- new USDA release is imported, update them together with that migration.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

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

-- The picks have no foreign key, since an import reloads every food. They name SR Legacy
-- foods, whose IDs never change; a new import that drops one fails here.
select is(
  (select count(*)::int from public.search_picks p
   where not exists (
     select 1 from public.usda_foods f join public.usda_releases r on r.id = f.release_id
     where f.fdc_id = p.fdc_id and r.dataset = 'sr_legacy_food')),
  0, 'every search pick names a loaded SR Legacy food');

-- A few real searches, so ranking can't quietly get worse.
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}', true);

select is((select name from public.search_foods('rice') limit 1),
          'Rice, white, long-grain, regular, unenriched, cooked without salt', '"rice" finds cooked white rice first');
select matches((select name from public.search_foods('tea') limit 1), '^Beverages, tea, ', '"tea" finds tea, not teaseed oil');
select matches((select name from public.search_foods('spinch') limit 1), '^Spinach, ', 'the typo "spinch" finds spinach');
select is((select name from public.search_foods('curd') limit 1), 'Yogurt, plain, whole milk',
          '"curd" finds whole-milk yogurt first');
select is((select name from public.search_foods('chicken breast') limit 1),
          'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw',
          '"chicken breast" finds broiler breast first, not a deli roll');
select is((select name from public.search_foods('egg') limit 1), 'Egg, whole, raw, fresh', '"egg" finds a whole egg first');
select is((select name from public.search_foods('eggs') limit 1), 'Egg, whole, raw, fresh', '"eggs" finds the same');
select matches((select name from public.search_foods('moong dal') limit 1), '^Mung beans, mature seeds, cooked',
               '"moong dal" finds cooked mung beans');
select matches((select name from public.search_foods('kala chana') limit 1), '^Chickpeas .*cooked',
               '"kala chana" finds cooked chickpeas');
select matches((select name from public.search_foods('beef') limit 1), '^Beef, composite of trimmed retail cuts',
               '"beef" finds plain beef first, not corned beef');
select is((select name from public.search_foods('mooli') limit 1), 'Radishes, oriental, raw',
          '"mooli" finds the long white radish');
select results_eq($$select name from public.search_foods('chicken', 2)$$,
                  array['Chicken, broilers or fryers, meat only, raw',
                        'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw'],
                  '"chicken" offers skinless broiler meat, whole and then breast, as broilers are sold here');
select is((select name from public.search_foods('salt') limit 1), 'Salt, table', '"salt" finds table salt, for the sodium');
select is((select name from public.search_foods('red chilli powder') limit 1), 'Spices, pepper, red or cayenne',
          '"red chilli powder" finds plain ground red chilli, not the American chili powder blend');
select is((select count(*)::int from public.search_foods('cauliflower') where name = 'Cauliflower, raw'), 1,
          '"cauliflower" shows raw cauliflower once, not again from the other USDA dataset');
select matches((select name from public.search_foods('haakh') limit 1), '^Collards, ', '"haakh" finds collard greens');
select matches((select name from public.search_foods('kong') limit 1), 'saffron', '"kong" finds saffron');
select matches((select name from public.search_foods('akhrot') limit 1), 'walnuts', '"akhrot" finds walnuts');
select is((select count(*)::int from public.search_foods('mutton') where name ilike '%goat%'), 0,
          '"mutton" means sheep in Kashmir, so it never shows goat foods such as goat cheese');

select * from finish();
rollback;
