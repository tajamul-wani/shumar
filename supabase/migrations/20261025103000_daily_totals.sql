-- Each day's totals over a range of dates, for the Trends screen: one row per day with food logged,
-- so a month is at most 31 rows instead of every log. Runs with the caller's rights, so row-level
-- security limits it to their own logs. The range is capped so one call can never ask for years.
create function public.daily_totals(from_date date, to_date date)
returns table (
  log_date date,
  kcal numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  sodium_mg numeric,
  foods integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    l.log_date,
    sum(l.kcal),
    sum(l.protein),
    sum(l.carbs),
    sum(l.fat),
    sum(l.sodium_mg),
    count(*)::integer
  from public.user_logs l
  where l.user_id = (select auth.uid())
    and l.log_date between from_date and to_date
    and to_date - from_date between 0 and 62
  group by l.log_date
  order by l.log_date;
$$;

comment on function public.daily_totals(date, date) is
  'The signed-in person''s calories, macros, sodium and food count for each day in a range of at most 63 days.';

-- Postgres lets everyone run new functions by default. Only signed-in people may call this one.
revoke all on function public.daily_totals(date, date) from public, anon, authenticated;
grant execute on function public.daily_totals(date, date) to authenticated;
