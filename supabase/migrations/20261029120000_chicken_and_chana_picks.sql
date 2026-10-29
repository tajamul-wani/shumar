-- Broiler chicken cuts first in search (SHU-31 PR, asked for by Tajamul Wani on 29 October 2026).
-- "chicken" showed the whole bird and the breast, then a roasted breast, the whole bird with skin
-- and a meatless product, which read as a muddle. It now offers the raw broiler cuts sold here: the
-- whole bird without skin, the breast without and then with skin, and the thigh without and then
-- with skin. All are SR Legacy foods, as every pick is.
-- "black channa", "kala channa" and "kabuli chana" found nothing, as only "black chana" and "kala
-- chana" were picks. Each spelling now finds chickpeas, as the others do.

delete from public.search_picks where term in ('chicken', 'murgh', 'broiler', 'chicken breast');

insert into public.search_picks (term, position, fdc_id)
select term, food.position, food.fdc_id
from (values
  -- Chicken, broilers or fryers: meat only, raw; breast, skinless, boneless, meat only, raw; breast,
  -- meat and skin, raw; dark meat, thigh, meat only, raw; thigh, meat and skin, raw
  (array['chicken', 'murgh', 'broiler'], array[171052, 171077, 171474, 173627, 172385]),
  -- The breast without skin, with skin, then roasted, for those who weigh it cooked
  (array['chicken breast'], array[171077, 171474, 171477]),
  -- The thigh without skin, then with skin
  (array['chicken thigh'], array[173627, 172385]),
  -- Chickpeas (garbanzo beans, bengal gram), mature seeds: cooked, boiled, without salt; raw
  (array['black channa', 'kala channa', 'kabuli chana', 'kabuli channa'], array[173757, 173756])
) as pick (terms, foods),
unnest(pick.terms) as term,
unnest(pick.foods) with ordinality as food (fdc_id, position);
