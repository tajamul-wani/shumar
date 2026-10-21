-- USDA foods and food search: only signed-in people can read the USDA tables or search,
-- nobody can change them through the API, and search ranks our own catalog first, handles
-- words still being typed and simple typos, and can't be tricked by special characters.
-- The fixture rows use the made-up word "kxtest" so they never collide with real foods.
-- They are placeholders, not nutrition data, and everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into public.usda_releases (id, dataset, file_name, file_sha256, imported_on)
values ('kxtest-release', 'sr_legacy_food', 'kxtest.zip', repeat('a', 64), '2026-10-21');

insert into public.usda_foods (fdc_id, release_id, name, category, kcal_per_100g, protein_per_100g,
                               carbs_per_100g, fat_per_100g, sodium_mg_per_100g, atwater_flag)
values
  (990001, 'kxtest-release', 'Kxtest rice, white, cooked', 'Test', 1, 1, 1, 1, 1, false),
  (990002, 'kxtest-release', 'Kxtest beverages, rice milk', 'Test', 1, 1, 1, 1, 1, false),
  (990003, 'kxtest-release', 'Kxtest chicken, breast, roasted', 'Test', 1, 1, 1, 1, 1, true),
  (990004, 'kxtest-release', 'Kxtest yogurt, plain', 'Test', 1, 1, 1, 1, 1, false),
  (990005, 'kxtest-release', 'Kxtest oil, teaseed', 'Test', 1, 1, 1, 1, 1, false),
  (990006, 'kxtest-release', 'Kxtest beverages, tea, brewed', 'Test', 1, 1, 1, 1, 1, false);

insert into public.usda_portions (fdc_id, unit_name, grams)
values (990001, '1 cup', 158);

insert into public.kashmiri_foods (id, name, aliases, category, kcal_per_100g, protein_per_100g,
                                   carbs_per_100g, fat_per_100g, source)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Kxtest nun chai', '{"kxtest noon chai"}', 'test',
        1, 1, 1, 1, 'Test fixture, not real data');

-- Structure and row-level security
select has_table('public', 'usda_releases', 'usda_releases exists');
select has_table('public', 'usda_foods', 'usda_foods exists');
select has_table('public', 'usda_portions', 'usda_portions exists');
select ok((select relrowsecurity from pg_class where oid = 'public.usda_releases'::regclass), 'RLS is on for usda_releases');
select ok((select relrowsecurity from pg_class where oid = 'public.usda_foods'::regclass), 'RLS is on for usda_foods');
select ok((select relrowsecurity from pg_class where oid = 'public.usda_portions'::regclass), 'RLS is on for usda_portions');
select ok((select relrowsecurity from pg_class where oid = 'public.search_synonyms'::regclass), 'RLS is on for search_synonyms');
select has_function('public', 'search_foods', array['text', 'integer'], 'search_foods(text, integer) exists');
select ok(not has_function_privilege('anon', 'public.search_foods(text, integer)', 'execute'), 'visitors cannot search');
select ok(has_function_privilege('authenticated', 'public.search_foods(text, integer)', 'execute'), 'signed-in people can search');

-- Signed-out visitor: no reads and no search
set local role anon;
select throws_ok('select count(*) from public.usda_foods', '42501', null, 'a visitor cannot read USDA foods');
select throws_ok('select count(*) from public.usda_portions', '42501', null, 'a visitor cannot read USDA portions');
select throws_ok('select count(*) from public.search_synonyms', '42501', null, 'a visitor cannot read search synonyms');
select throws_ok($$select * from public.search_foods('kxtest rice')$$, '42501', null, 'a visitor cannot search');
reset role;

-- Signed-in person: reads and searches, but cannot change anything
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}', true);

select results_eq($$select count(*)::int from public.usda_foods where fdc_id between 990001 and 990003$$,
                  array[3], 'a signed-in person can read USDA foods');
select throws_ok($$insert into public.usda_foods (fdc_id, release_id, name, category, kcal_per_100g, protein_per_100g,
                   carbs_per_100g, fat_per_100g, sodium_mg_per_100g, atwater_flag)
                   values (990009, 'kxtest-release', 'x', 'x', 0, 0, 0, 0, 0, false)$$,
                 '42501', null, 'a signed-in person cannot add USDA foods');
select throws_ok($$update public.usda_foods set kcal_per_100g = 0 where fdc_id = 990001$$,
                 '42501', null, 'a signed-in person cannot change USDA foods');
select throws_ok($$delete from public.usda_portions where fdc_id = 990001$$,
                 '42501', null, 'a signed-in person cannot delete USDA portions');

select is((select source from public.search_foods('kxtest') limit 1), 'kashmiri', 'our own catalog comes first');
select is((select name from public.search_foods('kxtest noon') limit 1), 'Kxtest nun chai',
          'a spelling stored as an alias finds the Kashmiri dish');
select is((select name from public.search_foods('kxtest ric') where source = 'usda' limit 1), 'Kxtest rice, white, cooked',
          'a word still being typed matches, and names that start with the search come first');
select is((select name from public.search_foods('kxtest curd') where source = 'usda' limit 1), 'Kxtest yogurt, plain',
          'a local word finds the USDA food through its synonym (curd for yogurt)');
select is((select name from public.search_foods('kxtest tea') where source = 'usda' limit 1), 'Kxtest beverages, tea, brewed',
          'a whole word beats a word that only starts with the search (tea before teaseed)');
select throws_ok($$insert into public.search_synonyms (term, usda_words) values ('kxtest', 'rice')$$,
                 '42501', null, 'a signed-in person cannot add search synonyms');
select is((select count(*)::int from public.search_foods('kxtest rice') where source = 'usda'), 2,
          'every USDA food with the words is found');
select is((select name from public.search_foods('kxtest chiken') where source = 'usda' limit 1), 'Kxtest chicken, breast, roasted',
          'a typo still finds the food');
select is((select units from public.search_foods('kxtest rice, white') where source = 'usda' limit 1), '[{"name": "1 cup", "grams": 158}]'::jsonb,
          'household portions come with each result');
select is((select flagged from public.search_foods('kxtest chicken') where source = 'usda' limit 1), true,
          'a food that fails the Atwater check is marked');
select is((select count(*)::int from public.search_foods('k')), 0, 'one character is too short to search');
select is((select count(*)::int from public.search_foods('%_')), 0, 'wildcard characters match nothing');
select is((select count(*)::int from public.search_foods('kxtest', 1)), 1, 'max_results limits the results');
select lives_ok($$select * from public.search_foods(repeat('kxtest rice ', 40))$$, 'a very long search is cut short, not an error');
select lives_ok($$select * from public.search_foods('kxtest''); drop table public.usda_foods; --')$$,
                'special characters in a search are treated as text');

select * from finish();
rollback;
