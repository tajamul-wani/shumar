-- Food logs must hold every food the search can return. Some USDA names are 134 characters
-- and some USDA portion labels are 60, longer than the first limits (120 and 30). The new
-- limits match usda_foods.name and usda_portions.unit_name.

alter table public.user_logs drop constraint user_logs_food_name_check;
alter table public.user_logs add constraint user_logs_food_name_check
  check (char_length(food_name) between 1 and 200);

alter table public.user_logs drop constraint user_logs_unit_name_check;
alter table public.user_logs add constraint user_logs_unit_name_check
  check (char_length(unit_name) between 1 and 60);
