-- A person may name a meal of their own ("Chai", "Pre-workout") beside the five fixed ones, so
-- user_logs.meal now takes any short name on one line with no spaces around it. The fixed meals
-- keep their keys (breakfast, lunch, evening_tea, dinner, snack); the app shows a key's label and
-- a person's name as typed. Decided by Tajamul Wani on 26 October 2026 with the Today redesign.
alter table public.user_logs drop constraint user_logs_meal_check;
alter table public.user_logs add constraint user_logs_meal_check
  check (
    char_length(meal) between 1 and 30
    and meal = btrim(meal)
    and meal !~ '[\n\r\t]'
  );

comment on column public.user_logs.meal is
  'One of breakfast, lunch, evening_tea, dinner, snack, or a short name of the person''s own, as typed.';
