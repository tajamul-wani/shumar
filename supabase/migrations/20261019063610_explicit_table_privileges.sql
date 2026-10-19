-- Make every table privilege explicit instead of relying on platform defaults.
-- Hosted Supabase projects grant the app roles (anon, authenticated) no table access by
-- default, while older defaults grant everything, including TRUNCATE, which ignores
-- row-level security. Granting exactly what the app needs gives the same result everywhere.

-- Start from nothing for the app roles on every table.
revoke all on public.kashmiri_foods, public.food_units, public.user_logs from anon, authenticated;

-- Catalog and unit weights: read only, for everyone.
grant select on public.kashmiri_foods, public.food_units to anon, authenticated;

-- Food logs: signed-in users only. Row-level security still limits them to their own rows.
grant select, insert, update, delete on public.user_logs to authenticated;

-- Supabase's rls_auto_enable() helper (hosted projects only) switches on row-level security
-- for new tables through an event trigger. It never needs to be called through the API.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
