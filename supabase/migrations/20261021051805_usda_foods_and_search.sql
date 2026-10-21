-- USDA FoodData Central foods and food search.
-- The USDA data is public domain (CC0). It is imported from the bulk downloads by
-- scripts/usda/import_usda.py into a later migration, so search never calls the USDA API.
-- Values are per 100 g, sodium in mg. Only signed-in people can read these tables or search.

-- ---------------------------------------------------------------------------
-- Which USDA files are loaded, so we always know which data is live
-- ---------------------------------------------------------------------------
create table public.usda_releases (
  id text primary key check (char_length(id) between 1 and 80),
  dataset text not null check (dataset in ('foundation_food', 'sr_legacy_food')),
  file_name text not null check (char_length(file_name) between 1 and 120),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  imported_on date not null
);

comment on table public.usda_releases is 'USDA FoodData Central files loaded into usda_foods, with the SHA-256 of each download.';

-- ---------------------------------------------------------------------------
-- Foods, one row per USDA FDC ID
-- ---------------------------------------------------------------------------
create table public.usda_foods (
  fdc_id integer primary key check (fdc_id > 0),
  release_id text not null references public.usda_releases (id),
  name text not null check (char_length(name) between 1 and 200),
  category text not null check (char_length(category) between 1 and 60),
  -- Up to 1,000 kcal, because pure fats reach about 902 kcal per 100 g.
  kcal_per_100g numeric(7, 2) not null check (kcal_per_100g between 0 and 1000),
  protein_per_100g numeric(6, 2) not null check (protein_per_100g between 0 and 100),
  carbs_per_100g numeric(6, 2) not null check (carbs_per_100g between 0 and 100),
  fat_per_100g numeric(6, 2) not null check (fat_per_100g between 0 and 100),
  sodium_mg_per_100g numeric(8, 2) not null check (sodium_mg_per_100g between 0 and 40000),
  -- True when 4 x protein + 4 x carbs + 9 x fat is more than 20% away from the stated calories.
  atwater_flag boolean not null,
  search tsvector generated always as (to_tsvector('english', name)) stored,
  -- USDA names foods "Main word, details". The main word is what typos are matched against.
  main_word text generated always as (lower(btrim(split_part(name, ',', 1)))) stored
);

comment on table public.usda_foods is 'USDA FoodData Central foods (public domain). Values are per 100 g as listed by USDA, sodium in mg.';

create index usda_foods_search on public.usda_foods using gin (search);
create index usda_foods_main_word_trgm on public.usda_foods using gin (main_word extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Household portions from USDA, such as "1 cup, chopped"
-- ---------------------------------------------------------------------------
create table public.usda_portions (
  fdc_id integer not null references public.usda_foods (fdc_id) on delete cascade,
  unit_name text not null check (char_length(unit_name) between 1 and 60),
  grams numeric(8, 2) not null check (grams > 0 and grams <= 5000),
  primary key (fdc_id, unit_name)
);

comment on table public.usda_portions is 'Weight in grams of one USDA household portion of a food.';

-- ---------------------------------------------------------------------------
-- Row-level security and privileges: signed-in people can read, nobody can write via the API
-- ---------------------------------------------------------------------------
alter table public.usda_releases enable row level security;
alter table public.usda_foods enable row level security;
alter table public.usda_portions enable row level security;

create policy "usda releases: signed-in people can read" on public.usda_releases
  for select to authenticated using (true);
create policy "usda foods: signed-in people can read" on public.usda_foods
  for select to authenticated using (true);
create policy "usda portions: signed-in people can read" on public.usda_portions
  for select to authenticated using (true);

revoke all on public.usda_releases, public.usda_foods, public.usda_portions from anon, authenticated;
grant select on public.usda_releases, public.usda_foods, public.usda_portions to authenticated;

-- ---------------------------------------------------------------------------
-- Search synonyms: the words people in Kashmir use for a food, mapped to the words
-- USDA uses. They only help a search find the right food; they never change a value.
-- usda_words holds alternatives separated by " | "; each alternative's words must all match.
-- ---------------------------------------------------------------------------
create table public.search_synonyms (
  term text primary key check (term ~ '^[a-z]{2,30}$'),
  usda_words text not null check (usda_words ~ '^[a-z]+( [a-z]+)*( \| [a-z]+( [a-z]+)*)*$')
);

comment on table public.search_synonyms is 'Local food words mapped to USDA wording, used only to find foods in search.';

alter table public.search_synonyms enable row level security;
create policy "search synonyms: signed-in people can read" on public.search_synonyms
  for select to authenticated using (true);
revoke all on public.search_synonyms from anon, authenticated;
grant select on public.search_synonyms to authenticated;

insert into public.search_synonyms (term, usda_words) values
  ('adrak', 'ginger'),
  ('akhrot', 'walnuts'),
  ('aloo', 'potatoes'),
  ('anda', 'egg'),
  ('arhar', 'pigeon peas'),
  ('atta', 'wheat flour whole'),
  ('aubergine', 'eggplant'),
  ('badam', 'almonds'),
  ('bhindi', 'okra'),
  ('brinjal', 'eggplant'),
  ('capsicum', 'peppers sweet'),
  ('chana', 'chickpeas'),
  ('chawal', 'rice'),
  ('chilli', 'peppers hot chili'),
  ('curd', 'yogurt'),
  ('daal', 'lentils'),
  ('dahi', 'yogurt'),
  ('dal', 'lentils'),
  ('dhaniya', 'coriander'),
  ('doodh', 'milk'),
  ('gogji', 'turnips'),
  ('groundnut', 'peanuts'),
  ('haakh', 'collards'),
  ('haldi', 'turmeric'),
  ('karela', 'bitter gourd'),
  ('kesar', 'saffron'),
  ('kong', 'saffron'),
  ('ladyfinger', 'okra'),
  ('lauki', 'calabash'),
  ('lehsun', 'garlic'),
  ('maida', 'wheat flour white'),
  ('maize', 'corn'),
  ('masoor', 'lentils pink'),
  ('methi', 'fenugreek'),
  ('monji', 'kohlrabi'),
  ('moong', 'mung beans'),
  ('mutton', 'lamb'),
  ('nadru', 'lotus root'),
  ('nadur', 'lotus root'),
  ('palak', 'spinach'),
  ('prawn', 'shrimp'),
  ('pudina', 'spearmint'),
  ('pyaz', 'onions'),
  ('rajma', 'kidney beans'),
  ('seb', 'apples'),
  ('tamatar', 'tomatoes'),
  ('toor', 'pigeon peas'),
  ('urad', 'mungo beans'),
  ('yoghurt', 'yogurt');

-- ---------------------------------------------------------------------------
-- Search: our own catalog first, then USDA foods by words (with prefixes for
-- typing in progress and local synonyms), then USDA foods by similar spelling for
-- typos, only when the words matched nothing.
-- USDA names foods "Main word, details", so a food whose main word (or first detail)
-- is the search ranks highest, whole words beat partial ones, and plainer foods win ties.
-- Portions are looked up only for the results returned.
-- Runs with the caller's rights, so row-level security still applies.
-- ---------------------------------------------------------------------------
create function public.search_foods(query text, max_results integer default 20)
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
  usda_words as (
    select 'usda'::text as source, null::uuid as kashmiri_id, f.fdc_id, f.name,
           1 as tier,
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
  ),
  usda_typos as (
    -- Similar spelling of the main word, for typos such as "spinch" or "chiken". Only for
    -- short searches, and only when the words matched nothing, so it never adds noise.
    select 'usda'::text as source, null::uuid as kashmiri_id, f.fdc_id, f.name,
           2 as tier,
           char_length(f.name) - char_length(replace(f.name, ',', '')) as qualifiers,
           extensions.similarity(f.main_word, q)::double precision as score
    from public.usda_foods f
    where cardinality(words) <= 2
      and not exists (select 1 from usda_words)
      and f.main_word operator(extensions.%) q
  ),
  top as (
    select u.*
    from (
      select * from kashmiri
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
  'Searches the Kashmiri catalog, then USDA foods. At most 50 results, values per 100 g.';

-- Postgres lets everyone run new functions by default. Only signed-in people may search.
revoke all on function public.search_foods(text, integer) from public, anon, authenticated;
grant execute on function public.search_foods(text, integer) to authenticated;
