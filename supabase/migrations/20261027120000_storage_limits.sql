-- How much one person can store, enforced in the database, so a request made outside the app
-- meets the same limits as the app (SHU-34, 27 October 2026): 100 foods a day and 50,000 in all,
-- 20 saved meals, and 30 foods in a saved meal. Without them, one signed-in person could fill the
-- free plan's database with their own rows.
--
-- Each check runs before the row goes in, under a lock on that person for the rest of the
-- transaction, so two requests at once can't both slip past a limit. Rows inserted earlier in the
-- same statement count, so one large insert is limited too. Restores load with
-- session_replication_role = replica, which skips these triggers, so a backup always goes back in.
-- Each limit has its own error code, which the app turns into a plain message.

create function public.check_log_limits() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('shumar-limits:' || new.user_id::text, 0));
  if (select count(*) from public.user_logs where user_id = new.user_id and log_date = new.log_date) >= 100 then
    raise exception 'A day holds up to 100 foods.' using errcode = 'SH001';
  end if;
  if (select count(*) from public.user_logs where user_id = new.user_id) >= 50000 then
    raise exception 'One account holds up to 50,000 foods.' using errcode = 'SH002';
  end if;
  return new;
end;
$$;

create function public.check_saved_meal_limits() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('shumar-limits:' || new.user_id::text, 0));
  if (select count(*) from public.saved_meals where user_id = new.user_id) >= 20 then
    raise exception 'One account holds up to 20 saved meals.' using errcode = 'SH003';
  end if;
  return new;
end;
$$;

create function public.check_saved_meal_food_limits() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('shumar-limits:' || new.user_id::text, 0));
  if (select count(*) from public.saved_meal_foods where saved_meal_id = new.saved_meal_id) >= 30 then
    raise exception 'A saved meal holds up to 30 foods.' using errcode = 'SH004';
  end if;
  return new;
end;
$$;

create trigger user_logs_limits before insert on public.user_logs
  for each row execute function public.check_log_limits();
create trigger saved_meals_limits before insert on public.saved_meals
  for each row execute function public.check_saved_meal_limits();
create trigger saved_meal_foods_limits before insert on public.saved_meal_foods
  for each row execute function public.check_saved_meal_food_limits();

-- Only the triggers run these; nobody calls them through the API. A trigger runs whatever the
-- caller's rights, so the signed-in person needs no grant on them.
revoke all on function public.check_log_limits() from public, anon, authenticated;
revoke all on function public.check_saved_meal_limits() from public, anon, authenticated;
revoke all on function public.check_saved_meal_food_limits() from public, anon, authenticated;
