-- Table privilege tests: the app roles hold exactly the privileges the app needs, and nothing
-- more. Exact sets, so an extra privilege (such as TRUNCATE, which ignores row-level security)
-- fails a test just like a missing one.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Signed-out visitors (anon)
select table_privs_are('public', 'kashmiri_foods', 'anon', array['SELECT'], 'visitors can only read the catalog');
select table_privs_are('public', 'food_units', 'anon', array['SELECT'], 'visitors can only read unit weights');
select table_privs_are('public', 'user_logs', 'anon', array[]::text[], 'visitors have no access to food logs');
select table_privs_are('public', 'profiles', 'anon', array[]::text[], 'visitors have no access to profiles');
select table_privs_are('public', 'usda_releases', 'anon', array['SELECT'], 'visitors can only read which USDA files are loaded');
select table_privs_are('public', 'usda_foods', 'anon', array[]::text[], 'visitors have no access to USDA foods');
select table_privs_are('public', 'usda_portions', 'anon', array[]::text[], 'visitors have no access to USDA portions');
select table_privs_are('public', 'search_synonyms', 'anon', array[]::text[], 'visitors have no access to search synonyms');

-- Signed-in users (authenticated)
select table_privs_are('public', 'kashmiri_foods', 'authenticated', array['SELECT'], 'signed-in users can only read the catalog');
select table_privs_are('public', 'food_units', 'authenticated', array['SELECT'], 'signed-in users can only read unit weights');
select table_privs_are(
  'public', 'user_logs', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'signed-in users can read, add, change and delete logs (row-level security limits them to their own), and cannot truncate');
select table_privs_are(
  'public', 'profiles', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'signed-in users can read, add, change and delete a profile (row-level security limits them to their own), and cannot truncate');
select table_privs_are('public', 'usda_releases', 'authenticated', array['SELECT'], 'signed-in users can only read USDA releases');
select table_privs_are('public', 'usda_foods', 'authenticated', array['SELECT'], 'signed-in users can only read USDA foods');
select table_privs_are('public', 'usda_portions', 'authenticated', array['SELECT'], 'signed-in users can only read USDA portions');
select table_privs_are('public', 'search_synonyms', 'authenticated', array['SELECT'], 'signed-in users can only read search synonyms');

-- Supabase's rls_auto_enable() helper exists only on hosted projects. Where it exists,
-- the app roles must not be able to call it through the API.
select case
  when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'rls_auto_enable')
  then ok(not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute'), 'visitors cannot call rls_auto_enable()')
  else skip('rls_auto_enable() exists only on hosted projects', 1)
end;
select case
  when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'rls_auto_enable')
  then ok(not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute'), 'signed-in users cannot call rls_auto_enable()')
  else skip('rls_auto_enable() exists only on hosted projects', 1)
end;

select * from finish();
rollback;
