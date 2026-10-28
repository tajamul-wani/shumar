-- Everyday foods first in search (SHU-36). For the words people type most, a short list names
-- the USDA foods to show first, as eaten: "rice" offers cooked white rice before black rice,
-- "curd" whole-milk yogurt before nonfat, and two-word names such as "moong dal" find mung beans.
-- Picks only choose which sourced USDA food comes first; they never add or change a value.

-- ---------------------------------------------------------------------------
-- Picks: a search, in lower case, and the USDA foods it shows first, in order
-- ---------------------------------------------------------------------------
create table public.search_picks (
  term text not null check (term ~ '^[a-z]{2,30}( [a-z]{2,30}){0,2}$'),
  position smallint not null check (position between 1 and 5),
  -- No foreign key: a USDA import deletes and reloads every food. The picks name SR Legacy
  -- foods, whose IDs never change, and usda_data.test.sql proves each one is loaded.
  fdc_id integer not null check (fdc_id > 0),
  primary key (term, position),
  unique (term, fdc_id)
);

comment on table public.search_picks is 'USDA foods shown first for an everyday search, such as cooked white rice for "rice".';

alter table public.search_picks enable row level security;
create policy "search picks: signed-in people can read" on public.search_picks
  for select to authenticated using (true);
revoke all on public.search_picks from anon, authenticated;
grant select on public.search_picks to authenticated;

-- Each row: the searches, then the SR Legacy foods they show first. Cooked comes first for rice, haakh,
-- pulses and lotus root, which are logged as eaten; raw comes first for meat, which is weighed raw.
insert into public.search_picks (term, position, fdc_id)
select term, food.position, food.fdc_id
from (values
  -- Rice, white, long-grain, regular, unenriched: cooked without salt, then raw. Rice here isn't enriched.
  (array['rice', 'white rice', 'chawal'], array[169757, 169756]),
  -- Broiler chicken. Skin changes the calories a lot, so both come, skinless first.
  -- Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw; Chicken, broilers or
  -- fryers, breast, meat and skin, raw; then breast, meat only, cooked, roasted
  (array['chicken breast'], array[171077, 171474, 171477]),
  -- Chicken, broilers or fryers, meat only, raw (the whole bird); meat and skin, raw; then the
  -- skinless breast, raw and roasted
  (array['chicken', 'broiler', 'murgh'], array[171052, 171447, 171077, 171477]),
  (array['whole chicken'], array[171052, 171447]),
  -- Yogurt, plain, whole milk
  (array['curd', 'dahi', 'yogurt', 'yoghurt'], array[171284]),
  -- Egg, whole, raw, fresh; then whole, cooked, hard-boiled
  (array['egg', 'anda'], array[171287, 173424]),
  -- Bananas, raw (with sizes from extra small to extra large)
  (array['banana', 'kela'], array[173944]),
  -- Butter, salted; then without salt
  (array['butter'], array[173410, 173430]),
  -- Butter, Clarified butter (ghee)
  (array['ghee'], array[171314]),
  -- Milk, whole, 3.25% milkfat, with added vitamin D
  (array['milk', 'doodh'], array[171265]),
  -- Mung beans, mature seeds, cooked, boiled, without salt; then raw
  (array['moong', 'moong dal', 'mung', 'mung dal'], array[174257, 174256]),
  -- Lentils, mature seeds, cooked, boiled, without salt; then Lentils, pink or red, raw
  (array['masoor', 'masoor dal'], array[172421, 174284]),
  -- Lentils, mature seeds, cooked, boiled, without salt; then Lentils, raw
  (array['dal', 'daal', 'lentil'], array[172421, 172420]),
  -- Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt; then raw
  (array['chana', 'channa', 'kala chana', 'black chana', 'chana dal', 'chickpea'], array[173757, 173756]),
  -- Mungo beans, mature seeds, cooked, boiled, without salt
  (array['urad', 'urad dal'], array[172427]),
  -- Pigeon peas (red gram), mature seeds, cooked, boiled, without salt
  (array['toor', 'arhar', 'toor dal', 'arhar dal'], array[172437]),
  -- Cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, without salt
  (array['lobia'], array[173759]),
  -- Chickpea flour (besan)
  (array['besan'], array[174288]),
  -- Beans, kidney, red, mature seeds, cooked, boiled, without salt; then raw
  (array['rajma', 'kidney bean'], array[175194, 173744]),
  -- Beef, composite of trimmed retail cuts, trimmed to 1/8" fat, all grades, raw: lean and fat,
  -- then lean only; then Beef, ground, 80% lean meat / 20% fat, raw
  (array['beef'], array[169483, 174758, 174036]),
  -- Lamb, composite of trimmed retail cuts, choice, raw: lean and fat (1/8" fat), then lean only.
  -- Mutton means sheep in Kashmir.
  (array['lamb', 'mutton'], array[172545, 174307]),
  -- Game meat, goat, raw; then cooked, roasted
  (array['goat'], array[175303, 175304]),
  -- Radishes, oriental, raw (the long white radish); for radish, Radishes, raw first
  (array['mooli'], array[168451]),
  (array['radish'], array[169276, 168451]),
  -- Carrots, raw
  (array['carrot', 'gajar'], array[170393]),
  -- Cucumber, with peel, raw
  (array['cucumber', 'kheera'], array[168409]),
  -- Watermelon, raw
  (array['watermelon', 'tarbooz'], array[167765]),
  -- Grapes, red or green (European type, such as Thompson seedless), raw
  (array['grape', 'angoor'], array[174683]),
  -- Oranges, raw, all commercial varieties
  (array['orange', 'santra'], array[169097]),
  -- Apples, raw, with skin
  (array['apple', 'seb'], array[171688]),
  -- Onions, raw
  (array['onion', 'pyaz'], array[170000]),
  -- Potatoes, flesh and skin, raw; then boiled, cooked in skin, flesh, without salt
  (array['potato', 'aloo'], array[170026, 170438]),
  -- Tomatoes, red, ripe, raw, year round average
  (array['tomato', 'tamatar'], array[170457]),
  -- Eggplant, raw
  (array['brinjal', 'eggplant', 'baingan'], array[169228]),
  -- Spinach, raw
  (array['spinach', 'palak'], array[168462]),
  -- Kale, raw
  (array['kale'], array[168421]),
  -- Gourd, white-flowered (calabash), raw
  (array['lauki', 'bottle gourd'], array[169232]),
  -- Lotus root, cooked, boiled, drained, without salt; then raw
  (array['nadru', 'nadur', 'lotus root', 'lotus stem'], array[168430, 169250]),
  -- Dates, medjool; then deglet noor
  (array['date', 'khajoor'], array[168191, 171726]),
  -- Oil, mustard
  (array['mustard oil', 'sarson oil'], array[172337]),

  -- Vegetables
  -- Collards, cooked, boiled, drained, without salt; then raw. Haakh is eaten cooked.
  (array['haakh', 'collards'], array[170407, 170406]),
  -- Cabbage, raw
  (array['cabbage', 'bandgobi'], array[169975]),
  -- Cauliflower, raw
  (array['cauliflower', 'gobi', 'phool gobi'], array[169986]),
  -- Peas, green, raw; then frozen, cooked, boiled, drained, without salt
  (array['pea', 'green pea', 'matar'], array[170419, 170017]),
  -- Beans, snap, green, raw
  (array['green bean', 'french bean'], array[169961]),
  -- Okra, raw
  (array['okra', 'bhindi', 'ladyfinger'], array[169260]),
  -- Peppers, sweet, green, raw
  (array['capsicum', 'shimla mirch', 'green pepper'], array[170427]),
  -- Turnips, raw
  (array['turnip', 'gogji'], array[170465]),
  -- Kohlrabi, raw
  (array['kohlrabi', 'monji'], array[168424]),
  -- Pumpkin, raw
  (array['pumpkin', 'kaddu'], array[168448]),
  -- Balsam-pear (bitter gourd), pods, raw
  (array['bitter gourd', 'karela'], array[168393]),
  -- Mushrooms, white, raw
  (array['mushroom'], array[169251]),
  -- Mustard greens, raw
  (array['mustard greens'], array[169256]),
  -- Beets, raw
  (array['beetroot', 'beet', 'chukandar'], array[169145]),
  -- Coriander (cilantro) leaves, raw; then Spices, coriander seed
  (array['coriander', 'dhaniya'], array[169997, 170922]),
  -- Peppers, hot chili, green, raw
  (array['green chilli', 'green chili', 'hari mirch'], array[170497]),
  -- Garlic, raw
  (array['garlic', 'lehsun'], array[169230]),
  -- Ginger root, raw; then Spices, ginger, ground
  (array['ginger', 'adrak'], array[169231, 170926]),

  -- Fruit
  -- Pomegranates, raw
  (array['pomegranate', 'anar'], array[169134]),
  -- Guavas, common, raw
  (array['guava', 'amrood'], array[173044]),
  -- Mangos, raw
  (array['mango', 'aam'], array[169910]),
  -- Pears, raw
  (array['pear', 'nashpati'], array[169118]),
  -- Cherries, sweet, raw
  (array['cherry', 'cherries'], array[171719]),
  -- Apricots, raw; then dried, sulfured, uncooked
  (array['apricot', 'khubani'], array[171697, 173941]),
  (array['dried apricot'], array[173941]),
  -- Plums, raw
  (array['plum', 'aloo bukhara'], array[169949]),
  -- Peaches, yellow, raw
  (array['peach', 'aadu'], array[169928]),
  -- Strawberries, raw
  (array['strawberry', 'strawberries'], array[167762]),
  -- Papayas, raw
  (array['papaya', 'papita'], array[169926]),
  -- Melons, cantaloupe, raw (muskmelon)
  (array['muskmelon', 'kharbooza'], array[169092]),
  -- Kiwifruit, green, raw
  (array['kiwi'], array[168153]),
  -- Lemons, raw, without peel
  (array['lemon', 'nimbu'], array[167746]),
  -- Nuts, walnuts, english
  (array['walnut', 'akhrot'], array[170187]),
  -- Nuts, almonds
  (array['almond', 'badam'], array[170567]),
  -- Figs, dried, uncooked
  (array['anjeer', 'dried fig'], array[174665]),

  -- Spices. USDA's "Spices, chili powder" is an American blend with cumin and oregano, so red
  -- chilli powder points to cayenne, plain ground red chilli; Kashmiri chilli is mild, so paprika first.
  -- Spices, pepper, red or cayenne; then Spices, paprika
  (array['red chilli powder', 'chilli powder', 'lal mirch'], array[170932, 171329]),
  (array['kashmiri mirch', 'kashmiri chilli'], array[171329, 170932]),
  -- Spices, turmeric, ground
  (array['turmeric', 'haldi'], array[172231]),
  -- Spices, fennel seed
  (array['fennel', 'saunf'], array[171323]),
  -- Spices, ginger, ground
  (array['dry ginger', 'ginger powder', 'sonth'], array[170926]),
  -- Spices, cumin seed
  (array['cumin', 'zeera', 'jeera'], array[170923]),
  -- Spices, cardamom
  (array['cardamom', 'elaichi'], array[170919]),
  -- Spices, cloves, ground
  (array['clove', 'laung'], array[171321]),
  -- Spices, cinnamon, ground
  (array['cinnamon', 'dalchini'], array[171320]),
  -- Spices, coriander seed
  (array['coriander powder', 'dhaniya powder'], array[170922]),
  -- Spices, pepper, black
  (array['black pepper', 'kali mirch'], array[170931]),
  -- Spices, saffron
  (array['saffron', 'kong', 'kesar'], array[170934]),
  -- Spices, bay leaf
  (array['bay leaf', 'tej patta'], array[170917]),
  -- Spices, mace, ground
  (array['mace', 'javitri'], array[170927]),
  -- Spices, nutmeg, ground
  (array['nutmeg', 'jaiphal'], array[171326]),
  -- Spices, poppy seed
  (array['poppy seed', 'khaskhas'], array[171330]),
  -- Spices, mustard seed, ground
  (array['mustard seed', 'rai'], array[170929]),
  -- Salt, table. It carries the sodium, so it needs to be easy to find.
  (array['salt', 'namak'], array[173468])
) as pick (terms, foods),
unnest(pick.terms) as term,
unnest(pick.foods) with ordinality as food (fdc_id, position);

-- More of the words people type, for searches beyond the picks.
insert into public.search_synonyms (term, usda_words) values
  ('angoor', 'grapes'),
  ('baingan', 'eggplant'),
  ('channa', 'chickpeas'),
  ('gajar', 'carrots'),
  ('kela', 'bananas'),
  ('khajoor', 'dates'),
  ('kheera', 'cucumber'),
  ('mooli', 'radishes oriental'),
  ('santra', 'oranges'),
  ('sarson', 'mustard'),
  ('tarbooz', 'watermelon');

-- ---------------------------------------------------------------------------
-- Search, as before, with the picks right after our own catalog. A plural ("eggs",
-- "potatoes") finds the picks of its singular. When the picks answer a search, other
-- USDA foods still follow, without a food of the same name as a pick, and spelling
-- guesses are left out.
-- ---------------------------------------------------------------------------
create or replace function public.search_foods(query text, max_results integer default 20)
returns table (
  source text,
  source_id text,
  name text,
  kcal_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  sodium_mg_per_100g numeric,
  flagged boolean,
  verified boolean,
  units jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
-- The result columns share names with table columns; in the queries, the table columns are meant.
#variable_conflict use_column
declare
  -- Lower case, single spaces, at most 64 characters.
  q text := lower(left(btrim(regexp_replace(coalesce(query, ''), '\s+', ' ', 'g')), 64));
  -- For LIKE: escape the wildcard characters a person might type.
  pattern text;
  words text[];
  -- Every word, matched as a prefix too (for words still being typed) or as its synonyms.
  prefix_q tsquery;
  -- Every word as a whole word, or its synonyms.
  exact_q tsquery;
  -- Main words that put a USDA food at the top: the search itself, its plural, and synonyms.
  main_words text[];
  -- The search and its singular, for the picks.
  pick_terms text[];
  lim integer := least(greatest(coalesce(max_results, 20), 1), 50);
begin
  if char_length(q) < 2 then
    return;
  end if;

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Letters and digits only, so the text can never change the meaning of the query.
  words := array(
    select w from unnest(regexp_split_to_array(regexp_replace(q, '[^[:alnum:]]+', ' ', 'g'), ' ')) as w
    where w <> ''
  );
  main_words := array[q, q || 's', q || 'es'];
  pick_terms := array[q];
  if q like '%s' then
    pick_terms := pick_terms || left(q, -1);
  end if;
  if q like '%es' then
    pick_terms := pick_terms || left(q, -2);
  end if;

  if cardinality(words) > 0 then
    prefix_q := to_tsquery('english', array_to_string(array(
      select '(' || w || ':*' || coalesce(' | ' || (
        select string_agg('(' || replace(alt, ' ', ' & ') || ')', ' | ')
        from public.search_synonyms syn, unnest(string_to_array(syn.usda_words, ' | ')) as alt
        where syn.term = w
      ), '') || ')'
      from unnest(words) as w
    ), ' & '));
    exact_q := to_tsquery('english', array_to_string(array(
      select '(' || w || coalesce(' | ' || (
        select string_agg('(' || replace(alt, ' ', ' & ') || ')', ' | ')
        from public.search_synonyms syn, unnest(string_to_array(syn.usda_words, ' | ')) as alt
        where syn.term = w
      ), '') || ')'
      from unnest(words) as w
    ), ' & '));
  end if;

  if cardinality(words) = 1 then
    main_words := main_words || array(
      select v
      from public.search_synonyms syn,
           unnest(string_to_array(syn.usda_words, ' | ')) as alt,
           unnest(array[alt, split_part(alt, ' ', 1)]) as v
      where syn.term = words[1]
    );
  end if;

  return query
  with kashmiri as (
    select 'kashmiri'::text as source, k.id as kashmiri_id, null::integer as fdc_id, k.name,
           0 as tier, 0 as qualifiers,
           greatest(
             extensions.similarity(lower(k.name), q),
             coalesce((select max(extensions.similarity(lower(a), q)) from unnest(k.aliases) as a), 0)
           )::double precision as score
    from public.kashmiri_foods k
    where lower(k.name) like pattern
       or extensions.similarity(lower(k.name), q) > 0.3
       or exists (
         select 1 from unnest(k.aliases) as a
         where lower(a) like pattern or extensions.similarity(lower(a), q) > 0.3
       )
  ),
  picks as (
    -- In the order the picks list them. A food picked for both the search and its singular counts once.
    select 'usda'::text as source, null::uuid as kashmiri_id, f.fdc_id, f.name,
           1 as tier, 0 as qualifiers,
           (10 - min(p.position))::double precision as score
    from public.search_picks p
    join public.usda_foods f on f.fdc_id = p.fdc_id
    where p.term = any(pick_terms)
    group by f.fdc_id, f.name
  ),
  usda_words as (
    select 'usda'::text as source, null::uuid as kashmiri_id, f.fdc_id, f.name,
           2 as tier,
           -- How many comma-separated details the name has: fewer means a plainer food.
           char_length(f.name) - char_length(replace(f.name, ',', '')) as qualifiers,
           (ts_rank_cd(f.search, prefix_q)
             -- The main word is the search: "Rice, white" for "rice", "Potatoes, raw" for "potato".
             + case when f.main_word = any(main_words) then 3 else 0 end
             -- Or the first detail is: "Beverages, tea" for "tea".
             + case when lower(btrim(split_part(f.name, ',', 2))) = any(main_words) then 2 else 0 end
             -- Whole words beat partial ones: "tea" before "teaseed".
             + case when f.search @@ exact_q then 1 else 0 end
             + case when lower(f.name) like q || '%' then 0.5 else 0 end)::double precision as score
    from public.usda_foods f
    where prefix_q is not null and f.search @@ prefix_q
      -- A picked food shows once, and so does its namesake from the other USDA dataset.
      and not exists (select 1 from picks where picks.fdc_id = f.fdc_id or picks.name = f.name)
  ),
  usda_typos as (
    -- Similar spelling of the main word, for typos such as "spinch" or "chiken". Only for
    -- short searches, and only when nothing else matched, so it never adds noise.
    select 'usda'::text as source, null::uuid as kashmiri_id, f.fdc_id, f.name,
           3 as tier,
           char_length(f.name) - char_length(replace(f.name, ',', '')) as qualifiers,
           extensions.similarity(f.main_word, q)::double precision as score
    from public.usda_foods f
    where cardinality(words) <= 2
      and not exists (select 1 from usda_words)
      and not exists (select 1 from picks)
      and f.main_word operator(extensions.%) q
  ),
  top as (
    select u.*
    from (
      select * from kashmiri
      union all
      select * from picks
      union all
      select * from usda_words
      union all
      select * from usda_typos
    ) as u
    order by u.tier, u.score desc, u.qualifiers, char_length(u.name), u.name
    limit lim
  )
  select
    t.source,
    coalesce(t.kashmiri_id::text, t.fdc_id::text),
    t.name,
    coalesce(k.kcal_per_100g, f.kcal_per_100g),
    coalesce(k.protein_per_100g, f.protein_per_100g),
    coalesce(k.carbs_per_100g, f.carbs_per_100g),
    coalesce(k.fat_per_100g, f.fat_per_100g),
    coalesce(k.sodium_mg_per_100g, f.sodium_mg_per_100g),
    coalesce(f.atwater_flag, false),
    coalesce(k.verified, true),
    case
      when t.source = 'kashmiri' then coalesce(
        (select jsonb_agg(jsonb_build_object('name', u.unit_name, 'grams', u.grams) order by u.grams)
         from public.food_units u where u.food_id = t.kashmiri_id),
        '[]'::jsonb)
      else coalesce(
        (select jsonb_agg(jsonb_build_object('name', p.unit_name, 'grams', p.grams) order by p.grams)
         from public.usda_portions p where p.fdc_id = t.fdc_id),
        '[]'::jsonb)
    end
  from top t
  left join public.kashmiri_foods k on k.id = t.kashmiri_id
  left join public.usda_foods f on f.fdc_id = t.fdc_id
  order by t.tier, t.score desc, t.qualifiers, char_length(t.name), t.name;
end;
$$;

comment on function public.search_foods(text, integer) is
  'Searches the Kashmiri catalog, then the everyday picks, then USDA foods. At most 50 results, values per 100 g.';

-- Replacing the function keeps its privileges; set them again so this file says them in full.
revoke all on function public.search_foods(text, integer) from public, anon, authenticated;
grant execute on function public.search_foods(text, integer) to authenticated;
