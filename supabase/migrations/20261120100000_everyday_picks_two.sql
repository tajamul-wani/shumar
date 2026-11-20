-- Everyday foods first in search, round two (SHU-39, asked for by Tajamul Wani on 20 November
-- 2026). "lentils cooked" showed sprouted stir-fried lentils first, "bread" showed pan dulce,
-- "oil" showed an industrial canola oil, "chicken" showed whole raw chicken above the breast,
-- "potatoes" showed raw ones before boiled, and "rice" had no medium-grain. All foods are SR
-- Legacy, whose IDs never change; each is named in a comment, and a pick only chooses which
-- sourced food comes first, never a value.
-- Cooked first for rice, lentils and potatoes, as they are eaten; raw first for chicken, which is
-- weighed raw, as before. Sprouted lentils are left out of the picks, so they come after the
-- ordinary ones.

delete from public.search_picks where term in (
  'rice', 'white rice', 'cooked rice', 'rice cooked', 'white rice cooked', 'cooked white rice', 'boiled rice',
  'raw rice', 'rice raw',
  'potato', 'boiled potato', 'potato boiled', 'cooked potato', 'raw potato',
  'chicken', 'chicken breast', 'chicken breast broiler', 'broiler chicken breast',
  'cooked chicken breast', 'chicken breast cooked',
  'bread', 'white bread', 'commercial white bread', 'commercial bread',
  'lentil', 'dal', 'lentil cooked', 'lentils cooked', 'cooked lentil', 'cooked lentils',
  'boiled lentil', 'boiled lentils', 'lentil boiled', 'lentils boiled',
  'dal cooked', 'cooked dal', 'boiled dal',
  'oil', 'cooking oil', 'oil cooking'
);

insert into public.search_picks (term, position, fdc_id)
select term, food.position, food.fdc_id
from (values
  -- Rice, white, long-grain, regular, unenriched, cooked without salt; Rice, white, medium-grain,
  -- cooked, unenriched; then Rice, white, long-grain, regular, raw, unenriched
  (array['rice', 'white rice', 'cooked rice', 'rice cooked', 'white rice cooked', 'cooked white rice', 'boiled rice'],
   array[169757, 168930, 169756]),
  -- Rice, white, long-grain, regular, raw, unenriched
  (array['raw rice', 'rice raw'], array[169756]),
  -- Potatoes, boiled, cooked in skin, flesh, without salt; then Potatoes, flesh and skin, raw
  (array['potato', 'boiled potato', 'potato boiled', 'cooked potato'], array[170438, 170026]),
  -- Potatoes, flesh and skin, raw
  (array['raw potato'], array[170026]),
  -- Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw; Chicken, broilers or
  -- fryers, breast, meat only, cooked, roasted; Chicken, broilers or fryers, meat only, raw; then
  -- Chicken, broilers or fryers, breast, meat and skin, raw and one of those picked before (a search
  -- lists at most five)
  (array['chicken'], array[171077, 171477, 171052, 171474, 173627]),
  -- The breast raw, cooked roasted, then with skin raw
  (array['chicken breast', 'chicken breast broiler', 'broiler chicken breast'], array[171077, 171477, 171474]),
  -- Chicken, broilers or fryers, breast, meat only, cooked, roasted; then the raw breast
  (array['cooked chicken breast', 'chicken breast cooked'], array[171477, 171077]),
  -- Bread, white, commercially prepared (includes soft bread crumbs)
  (array['bread', 'white bread', 'commercial white bread', 'commercial bread'], array[174924]),
  -- Lentils, mature seeds, cooked, boiled, without salt; with salt; Lentils, raw; Lentils, pink or
  -- red, raw. Sprouted lentils come after these.
  (array['lentil', 'dal'], array[172421, 175254, 172420, 174284]),
  -- Lentils, mature seeds, cooked, boiled, without salt; then with salt
  (array['lentil cooked', 'lentils cooked', 'cooked lentil', 'cooked lentils', 'boiled lentil', 'boiled lentils',
         'lentil boiled', 'lentils boiled', 'dal cooked', 'cooked dal', 'boiled dal'],
   array[172421, 175254]),
  -- Oil, mustard; Oil, olive, salad or cooking; Oil, coconut; Oil, peanut, salad or cooking; Oil, canola
  (array['oil', 'cooking oil', 'oil cooking'], array[172337, 171413, 171412, 171410, 172336])
) as pick (terms, foods),
unnest(pick.terms) as term,
unnest(pick.foods) with ordinality as food (fdc_id, position);
