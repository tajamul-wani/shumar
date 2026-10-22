-- How many different days the signed-in person has logged food on, for the "days logged" count
-- on Today. It returns one number instead of every log date, so the app reads almost nothing.
-- Runs with the caller's rights, so row-level security still limits it to their own logs.
create function public.days_logged()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(distinct log_date)::integer
  from public.user_logs
  where user_id = (select auth.uid());
$$;

comment on function public.days_logged() is
  'The number of different days the signed-in person has logged food on.';

-- Postgres lets everyone run new functions by default. Only signed-in people may call this one.
revoke all on function public.days_logged() from public, anon, authenticated;
grant execute on function public.days_logged() to authenticated;
