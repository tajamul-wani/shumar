-- Calcium, magnesium and vitamin D on foods (SHU-39, asked for by Tajamul Wani on 20 November 2026).
-- USDA foods get three columns that stay null where USDA lists no value ("not listed", never a
-- zero); the values come with the data migration that follows, from the same USDA files. A
-- person's own foods get the same three, and sodium becomes optional beside them. Logs and saved
-- meals keep a snapshot of the three, as they do for every other value. Only the foods' own
-- columns grow: totals, trends and the daily calorie work are unchanged.

-- USDA foods: per 100 g, calcium and magnesium in mg and vitamin D (D2 plus D3) in micrograms.
alter table public.usda_foods
  add column calcium_mg_per_100g numeric(8, 2) check (calcium_mg_per_100g between 0 and 10000),
  add column magnesium_mg_per_100g numeric(8, 2) check (magnesium_mg_per_100g between 0 and 5000),
  add column vitamin_d_mcg_per_100g numeric(8, 2) check (vitamin_d_mcg_per_100g between 0 and 5000);

-- A person's own foods: all four of sodium, calcium, magnesium and vitamin D are optional, as the
-- label may not list them. They are kept as the label prints them, and worked out per 100 g.
alter table public.my_foods
  alter column sodium_mg drop not null,
  add column calcium_mg numeric(9, 2) check (calcium_mg >= 0),
  add column magnesium_mg numeric(9, 2) check (magnesium_mg >= 0),
  add column vitamin_d_mcg numeric(9, 2) check (vitamin_d_mcg >= 0),
  add column calcium_mg_per_100g numeric generated always as (round(calcium_mg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column magnesium_mg_per_100g numeric generated always as (round(magnesium_mg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column vitamin_d_mcg_per_100g numeric generated always as (round(vitamin_d_mcg * 100 / coalesce(serving_grams, 100), 4)) stored,
  -- The same limits per 100 g as USDA foods have.
  add constraint my_foods_micros_per_100g check (
    calcium_mg * 100 <= 10000 * coalesce(serving_grams, 100)
    and magnesium_mg * 100 <= 5000 * coalesce(serving_grams, 100)
    and vitamin_d_mcg * 100 <= 5000 * coalesce(serving_grams, 100)
  );

-- What was logged, and what a saved meal holds: a snapshot, null where the food had no value.
alter table public.user_logs
  add column calcium_mg numeric(9, 2) check (calcium_mg >= 0),
  add column magnesium_mg numeric(9, 2) check (magnesium_mg >= 0),
  add column vitamin_d_mcg numeric(9, 2) check (vitamin_d_mcg >= 0);
alter table public.saved_meal_foods
  add column calcium_mg numeric(9, 2) check (calcium_mg >= 0),
  add column magnesium_mg numeric(9, 2) check (magnesium_mg >= 0),
  add column vitamin_d_mcg numeric(9, 2) check (vitamin_d_mcg >= 0);

-- ---------------------------------------------------------------------------
-- Search, as in 20261029110000_egg_picks.sql, with the three values on every result. A function's
-- result columns can't change in place, so it is dropped and made again, and its access is
-- granted again.
-- ---------------------------------------------------------------------------
drop function public.search_foods(text, integer);

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
  calcium_mg_per_100g numeric,
  magnesium_mg_per_100g numeric,
  vitamin_d_mcg_per_100g numeric,
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
    -- Not listed is null: a food without the value, never a zero. Kashmiri catalog foods have none yet.
    coalesce(m.calcium_mg_per_100g, f.calcium_mg_per_100g),
    coalesce(m.magnesium_mg_per_100g, f.magnesium_mg_per_100g),
    coalesce(m.vitamin_d_mcg_per_100g, f.vitamin_d_mcg_per_100g),
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

revoke all on function public.search_foods(text, integer) from public, anon, authenticated;
grant execute on function public.search_foods(text, integer) to authenticated;
