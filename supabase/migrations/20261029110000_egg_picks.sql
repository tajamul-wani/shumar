-- Egg dishes first in search (SHU-31 PR, asked for by Tajamul Wani on 29 October 2026). Search
-- showed dried egg white powder for "egg white", a frozen mix for "scrambled egg", and nothing for
-- "omelette" or "boiled egg white". Each common way of eating eggs now has its pick, all SR Legacy
-- foods as before, and picks ignore punctuation, so "hard-boiled egg" finds "hard boiled egg".
-- USDA has no boiled egg white: boiled egg white points to raw egg white, which boiling in the shell
-- neither adds to nor takes from.
-- Among equally good matches, a dried, dry, dehydrated or powdered form now comes after the fresh
-- ones, so "white egg" lists raw egg white before the dried powder. A search for a dried food
-- ("dried apricot") matches only dried forms, as every word must match, so it is unchanged.

-- Searches of up to four words, such as "hard boiled egg white".
alter table public.search_picks drop constraint search_picks_term_check;
alter table public.search_picks add constraint search_picks_term_check
  check (term ~ '^[a-z]{2,30}( [a-z]{2,30}){0,3}$');

-- "egg" now offers the ways eggs are eaten most: hard-boiled, egg white and scrambled first, as
-- Tajamul Wani asked on 29 October 2026, then the raw egg for cooking and the fried egg.
delete from public.search_picks where term in ('egg', 'anda');

insert into public.search_picks (term, position, fdc_id)
select term, food.position, food.fdc_id
from (values
  -- Egg, whole, cooked, hard-boiled; Egg, white, raw, fresh; Egg, whole, cooked, scrambled; then
  -- Egg, whole, raw, fresh and Egg, whole, cooked, fried
  (array['egg', 'anda'], array[173424, 172183, 172187, 171287, 173423]),
  -- Egg, white, raw, fresh
  (array['egg white', 'boiled egg white', 'hard boiled egg white'], array[172183]),
  -- Egg, yolk, raw, fresh
  (array['egg yolk'], array[172184]),
  -- Egg, whole, cooked, hard-boiled
  (array['boiled egg', 'hard boiled egg', 'egg boiled'], array[173424]),
  -- Egg, whole, cooked, scrambled
  (array['scrambled egg', 'egg scrambled'], array[172187]),
  -- Egg, whole, cooked, fried
  (array['fried egg', 'egg fried'], array[173423]),
  -- Egg, whole, cooked, omelet
  (array['omelette', 'omelet', 'egg omelette', 'egg omelet'], array[172185]),
  -- Egg, whole, cooked, poached
  (array['poached egg', 'egg poached'], array[172186])
) as pick (terms, foods),
unnest(pick.terms) as term,
unnest(pick.foods) with ordinality as food (fdc_id, position);

-- ---------------------------------------------------------------------------
-- Search, as in 20261029100000_my_foods.sql, with picks found by their letters alone and dried
-- forms after fresh ones.
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
  -- The search in letters and single spaces, and its singular, for the picks.
  pick_key text;
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
  -- Picks are found by their letters alone: "hard-boiled egg" finds "hard boiled egg".
  pick_key := btrim(regexp_replace(q, '[^[:alpha:]]+', ' ', 'g'));
  pick_terms := array[pick_key];
  if pick_key like '%s' then
    pick_terms := pick_terms || left(pick_key, -1);
  end if;
  if pick_key like '%es' then
    pick_terms := pick_terms || left(pick_key, -2);
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
  -- own_id is the id of one of our own rows: a food of the person's own, or a Kashmiri catalog food.
  with mine as (
    select 'mine'::text as source, m.id as own_id, null::integer as fdc_id, m.display_name as name,
           -1 as tier, 0 as dried, 0 as qualifiers,
           extensions.similarity(lower(m.display_name), q)::double precision as score
    from public.my_foods m
    where lower(m.display_name) like pattern
       or extensions.similarity(lower(m.display_name), q) > 0.3
  ),
  kashmiri as (
    select 'kashmiri'::text as source, k.id as own_id, null::integer as fdc_id, k.name,
           0 as tier, 0 as dried, 0 as qualifiers,
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
    select 'usda'::text as source, null::uuid as own_id, f.fdc_id, f.name,
           1 as tier, 0 as dried, 0 as qualifiers,
           (10 - min(p.position))::double precision as score
    from public.search_picks p
    join public.usda_foods f on f.fdc_id = p.fdc_id
    where p.term = any(pick_terms)
    group by f.fdc_id, f.name
  ),
  usda_words as (
    select 'usda'::text as source, null::uuid as own_id, f.fdc_id, f.name,
           2 as tier,
           -- A dried form, after the fresh ones that match as well: "Egg, white, dried" after "Egg, white, raw".
           case when f.name ~* '\m(dried|dry|dehydrated|powder|powdered)\M' then 1 else 0 end as dried,
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
    select 'usda'::text as source, null::uuid as own_id, f.fdc_id, f.name,
           3 as tier,
           case when f.name ~* '\m(dried|dry|dehydrated|powder|powdered)\M' then 1 else 0 end as dried,
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
      select * from mine
      union all
      select * from kashmiri
      union all
      select * from picks
      union all
      select * from usda_words
      union all
      select * from usda_typos
    ) as u
    order by u.tier, u.score desc, u.dried, u.qualifiers, char_length(u.name), u.name
    limit lim
  )
  select
    t.source,
    coalesce(t.own_id::text, t.fdc_id::text),
    t.name,
    coalesce(m.kcal_per_100g, k.kcal_per_100g, f.kcal_per_100g),
    coalesce(m.protein_per_100g, k.protein_per_100g, f.protein_per_100g),
    coalesce(m.carbs_per_100g, k.carbs_per_100g, f.carbs_per_100g),
    coalesce(m.fat_per_100g, k.fat_per_100g, f.fat_per_100g),
    coalesce(m.sodium_mg_per_100g, k.sodium_mg_per_100g, f.sodium_mg_per_100g),
    coalesce(
      f.atwater_flag,
      abs(4 * m.protein_per_100g + 4 * m.carbs_per_100g + 9 * m.fat_per_100g - m.kcal_per_100g)
        > greatest(0.20 * m.kcal_per_100g, 4),
      false),
    coalesce(k.verified, true),
    case
      when t.source = 'mine' then
        case when m.serving_grams is null then '[]'::jsonb
             else jsonb_build_array(jsonb_build_object('name', '1 serving', 'grams', m.serving_grams))
        end
      when t.source = 'kashmiri' then coalesce(
        (select jsonb_agg(jsonb_build_object('name', u.unit_name, 'grams', u.grams) order by u.grams)
         from public.food_units u where u.food_id = t.own_id),
        '[]'::jsonb)
      else coalesce(
        (select jsonb_agg(jsonb_build_object('name', p.unit_name, 'grams', p.grams) order by p.grams)
         from public.usda_portions p where p.fdc_id = t.fdc_id),
        '[]'::jsonb)
    end
  from top t
  left join public.my_foods m on t.source = 'mine' and m.id = t.own_id
  left join public.kashmiri_foods k on t.source = 'kashmiri' and k.id = t.own_id
  left join public.usda_foods f on f.fdc_id = t.fdc_id
  order by t.tier, t.score desc, t.dried, t.qualifiers, char_length(t.name), t.name;
end;
$$;

comment on function public.search_foods(text, integer) is
  'Searches the person''s own foods, the Kashmiri catalog, the everyday picks, then USDA foods. At most 50 results, values per 100 g.';

-- Replacing the function keeps its privileges; set them again so this file says them in full.
revoke all on function public.search_foods(text, integer) from public, anon, authenticated;
grant execute on function public.search_foods(text, integer) to authenticated;
