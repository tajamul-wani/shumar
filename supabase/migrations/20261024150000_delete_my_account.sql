-- Lets a signed-in person delete their own account from the You screen. Their profile and every
-- food log go with it, because both tables reference auth.users with on delete cascade.
-- It runs with the function owner's rights, since the app roles have no rights on auth.users,
-- and it only ever deletes the caller's own row.
create function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

comment on function public.delete_my_account() is
  'Deletes the signed-in person''s account, profile and every food log.';

-- Postgres lets everyone run new functions by default. Only signed-in people may call this one.
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- The home page's sources link works before sign-in, so visitors may read which USDA files are
-- loaded: file names and hashes only, nothing about any person.
grant select on public.usda_releases to anon;
create policy "usda releases: visitors can read" on public.usda_releases
  for select to anon using (true);
