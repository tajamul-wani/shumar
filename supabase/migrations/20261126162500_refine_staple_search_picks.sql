-- Refine staple search picks for white rice, banana, eggs, and potatoes (SHU-42).
-- - White rice: medium-grain cooked (168930) and uncooked/raw (169760) top of search.
-- - Banana: normal banana (173944, Bananas, raw).
-- - Egg: whole egg boiled (173424), whole egg scrambled (172187), egg white only (172183), egg yolk only (172184).
-- - Potatoes: cooked/boiled without salt (170438), boiled with salt (170114), raw with skin (170026), raw without skin (2346401).

delete from public.search_picks where term in (
  'rice', 'white rice', 'cooked rice', 'rice cooked', 'white rice cooked', 'cooked white rice', 'boiled rice', 'chawal',
  'raw rice', 'rice raw', 'uncooked rice', 'uncooked white rice',
  'banana', 'bananas', 'kela',
  'egg', 'eggs', 'anda', 'ande',
  'potato', 'potatoes', 'aloo', 'alu',
  'boiled potato', 'potato boiled', 'boiled potatoes', 'potatoes boiled',
  'cooked potato', 'cooked potatoes', 'potato cooked', 'potatoes cooked',
  'raw potato', 'raw potatoes', 'potato raw', 'potatoes raw'
);

insert into public.search_picks (term, position, fdc_id)
select term, food.position, food.fdc_id
from (values
  -- White rice: medium-grain cooked unenriched (168930), medium-grain raw unenriched (169760),
  -- then long-grain cooked (169757) and long-grain raw (169756)
  (array['rice', 'white rice', 'cooked rice', 'rice cooked', 'white rice cooked', 'cooked white rice', 'boiled rice', 'chawal'],
   array[168930, 169760, 169757, 169756]),

  -- Uncooked / raw rice: medium-grain raw (169760), then long-grain raw (169756)
  (array['raw rice', 'rice raw', 'uncooked rice', 'uncooked white rice'],
   array[169760, 169756]),

  -- Banana: normal banana (Bananas, raw, 173944), then Foundation banana (1105314)
  (array['banana', 'bananas', 'kela'],
   array[173944, 1105314]),

  -- Eggs: boiled whole egg (173424), scrambled whole egg (172187), egg white only (172183), egg yolk only (172184), then raw whole egg (171287)
  (array['egg', 'eggs', 'anda', 'ande'],
   array[173424, 172187, 172183, 172184, 171287]),

  -- Potatoes: boiled without salt (170438), boiled with salt (170114), raw with skin (170026), raw without skin (2346401)
  (array['potato', 'potatoes', 'aloo', 'alu'],
   array[170438, 170114, 170026, 2346401]),

  -- Boiled / cooked potatoes: boiled without salt (170438), boiled with salt (170114)
  (array['boiled potato', 'potato boiled', 'boiled potatoes', 'potatoes boiled',
         'cooked potato', 'cooked potatoes', 'potato cooked', 'potatoes cooked'],
   array[170438, 170114]),

  -- Raw potatoes: raw with skin (170026), raw without skin (2346401)
  (array['raw potato', 'raw potatoes', 'potato raw', 'potatoes raw'],
   array[170026, 2346401])
) as pick (terms, foods),
unnest(pick.terms) as term,
unnest(pick.foods) with ordinality as food (fdc_id, position);
