-- Dietary fiber and essential vitamins and minerals on foods and logs (SHU-41, asked for by Tajamul Wani on 24 November 2026).
-- Columns stay null where a source lists no value ("not listed", never zero).
-- USDA foods get values from the USDA importer data migration.
-- Kashmiri catalog foods are calculated from cited raw ingredients and cooking yields.
-- A person's own foods get optional fields that scale per 100 g.
-- Logs and saved meals keep an immutable snapshot at log time.

-- 1. USDA foods
alter table public.usda_foods
  add column fiber_g_per_100g numeric(6, 2) check (fiber_g_per_100g between 0 and 100),
  add column iron_mg_per_100g numeric(8, 2) check (iron_mg_per_100g between 0 and 1000),
  add column potassium_mg_per_100g numeric(8, 2) check (potassium_mg_per_100g between 0 and 50000),
  add column zinc_mg_per_100g numeric(8, 2) check (zinc_mg_per_100g between 0 and 1000),
  add column vitamin_b12_mcg_per_100g numeric(8, 2) check (vitamin_b12_mcg_per_100g between 0 and 5000),
  add column vitamin_c_mg_per_100g numeric(8, 2) check (vitamin_c_mg_per_100g between 0 and 5000),
  add column vitamin_a_mcg_per_100g numeric(8, 2) check (vitamin_a_mcg_per_100g between 0 and 30000),
  add column folate_mcg_per_100g numeric(8, 2) check (folate_mcg_per_100g between 0 and 10000);

-- 2. Kashmiri foods
alter table public.kashmiri_foods
  add column fiber_g_per_100g numeric(6, 2) check (fiber_g_per_100g between 0 and 100),
  add column calcium_mg_per_100g numeric(8, 2) check (calcium_mg_per_100g between 0 and 10000),
  add column magnesium_mg_per_100g numeric(8, 2) check (magnesium_mg_per_100g between 0 and 5000),
  add column vitamin_d_mcg_per_100g numeric(8, 2) check (vitamin_d_mcg_per_100g between 0 and 5000),
  add column iron_mg_per_100g numeric(8, 2) check (iron_mg_per_100g between 0 and 1000),
  add column potassium_mg_per_100g numeric(8, 2) check (potassium_mg_per_100g between 0 and 50000),
  add column zinc_mg_per_100g numeric(8, 2) check (zinc_mg_per_100g between 0 and 1000),
  add column vitamin_b12_mcg_per_100g numeric(8, 2) check (vitamin_b12_mcg_per_100g between 0 and 5000),
  add column vitamin_c_mg_per_100g numeric(8, 2) check (vitamin_c_mg_per_100g between 0 and 5000),
  add column vitamin_a_mcg_per_100g numeric(8, 2) check (vitamin_a_mcg_per_100g between 0 and 30000),
  add column folate_mcg_per_100g numeric(8, 2) check (folate_mcg_per_100g between 0 and 10000);

-- Update staple Kashmiri foods with cited values calculated from raw ingredients
update public.kashmiri_foods
set
  fiber_g_per_100g = 1.96,
  calcium_mg_per_100g = 10.95,
  magnesium_mg_per_100g = 16.12,
  vitamin_d_mcg_per_100g = 0.00,
  iron_mg_per_100g = 3.38,
  potassium_mg_per_100g = 79.65,
  zinc_mg_per_100g = 0.53,
  vitamin_b12_mcg_per_100g = 0.01,
  vitamin_c_mg_per_100g = 0.00,
  vitamin_a_mcg_per_100g = 0.00,
  folate_mcg_per_100g = 132.61
where id = 'c0000000-0000-0000-0000-000000000001'; -- Girda

update public.kashmiri_foods
set
  fiber_g_per_100g = 3.33,
  calcium_mg_per_100g = 193.33,
  magnesium_mg_per_100g = 22.50,
  vitamin_d_mcg_per_100g = 0.00,
  iron_mg_per_100g = 0.39,
  potassium_mg_per_100g = 177.50,
  zinc_mg_per_100g = 0.18,
  vitamin_b12_mcg_per_100g = 0.00,
  vitamin_c_mg_per_100g = 29.42,
  vitamin_a_mcg_per_100g = 209.17,
  folate_mcg_per_100g = 107.50
where id = 'c0000000-0000-0000-0000-000000000002'; -- Haakh

update public.kashmiri_foods
set
  fiber_g_per_100g = 0.00,
  calcium_mg_per_100g = 56.50,
  magnesium_mg_per_100g = 5.00,
  vitamin_d_mcg_per_100g = 0.65,
  iron_mg_per_100g = 0.02,
  potassium_mg_per_100g = 66.00,
  zinc_mg_per_100g = 0.19,
  vitamin_b12_mcg_per_100g = 0.23,
  vitamin_c_mg_per_100g = 0.00,
  vitamin_a_mcg_per_100g = 23.00,
  folate_mcg_per_100g = 2.50
where id = 'c0000000-0000-0000-0000-000000000003'; -- Nun chai

update public.kashmiri_foods
set
  fiber_g_per_100g = 0.24,
  calcium_mg_per_100g = 5.15,
  magnesium_mg_per_100g = 5.14,
  vitamin_d_mcg_per_100g = 0.00,
  iron_mg_per_100g = 0.07,
  potassium_mg_per_100g = 14.02,
  zinc_mg_per_100g = 0.06,
  vitamin_b12_mcg_per_100g = 0.00,
  vitamin_c_mg_per_100g = 0.00,
  vitamin_a_mcg_per_100g = 0.00,
  folate_mcg_per_100g = 0.84
where id = 'c0000000-0000-0000-0000-000000000004'; -- Kehva

-- 3. A person's own foods
alter table public.my_foods
  add column fiber_g numeric(7, 2) check (fiber_g >= 0),
  add column iron_mg numeric(9, 2) check (iron_mg >= 0),
  add column potassium_mg numeric(9, 2) check (potassium_mg >= 0),
  add column zinc_mg numeric(9, 2) check (zinc_mg >= 0),
  add column vitamin_b12_mcg numeric(9, 2) check (vitamin_b12_mcg >= 0),
  add column vitamin_c_mg numeric(9, 2) check (vitamin_c_mg >= 0),
  add column vitamin_a_mcg numeric(9, 2) check (vitamin_a_mcg >= 0),
  add column folate_mcg numeric(9, 2) check (folate_mcg >= 0),
  add column fiber_g_per_100g numeric generated always as (round(fiber_g * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column iron_mg_per_100g numeric generated always as (round(iron_mg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column potassium_mg_per_100g numeric generated always as (round(potassium_mg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column zinc_mg_per_100g numeric generated always as (round(zinc_mg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column vitamin_b12_mcg_per_100g numeric generated always as (round(vitamin_b12_mcg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column vitamin_c_mg_per_100g numeric generated always as (round(vitamin_c_mg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column vitamin_a_mcg_per_100g numeric generated always as (round(vitamin_a_mcg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add column folate_mcg_per_100g numeric generated always as (round(folate_mcg * 100 / coalesce(serving_grams, 100), 4)) stored,
  add constraint my_foods_micros_extended check (
    (fiber_g is null or fiber_g * 100 <= 100 * coalesce(serving_grams, 100))
    and (iron_mg is null or iron_mg * 100 <= 1000 * coalesce(serving_grams, 100))
    and (potassium_mg is null or potassium_mg * 100 <= 50000 * coalesce(serving_grams, 100))
    and (zinc_mg is null or zinc_mg * 100 <= 1000 * coalesce(serving_grams, 100))
    and (vitamin_b12_mcg is null or vitamin_b12_mcg * 100 <= 5000 * coalesce(serving_grams, 100))
    and (vitamin_c_mg is null or vitamin_c_mg * 100 <= 5000 * coalesce(serving_grams, 100))
    and (vitamin_a_mcg is null or vitamin_a_mcg * 100 <= 30000 * coalesce(serving_grams, 100))
    and (folate_mcg is null or folate_mcg * 100 <= 10000 * coalesce(serving_grams, 100))
  );

-- 4. User logs and saved meals
alter table public.user_logs
  add column fiber_g numeric(7, 2) check (fiber_g >= 0),
  add column iron_mg numeric(9, 2) check (iron_mg >= 0),
  add column potassium_mg numeric(9, 2) check (potassium_mg >= 0),
  add column zinc_mg numeric(9, 2) check (zinc_mg >= 0),
  add column vitamin_b12_mcg numeric(9, 2) check (vitamin_b12_mcg >= 0),
  add column vitamin_c_mg numeric(9, 2) check (vitamin_c_mg >= 0),
  add column vitamin_a_mcg numeric(9, 2) check (vitamin_a_mcg >= 0),
  add column folate_mcg numeric(9, 2) check (folate_mcg >= 0);

alter table public.saved_meal_foods
  add column fiber_g numeric(7, 2) check (fiber_g >= 0),
  add column iron_mg numeric(9, 2) check (iron_mg >= 0),
  add column potassium_mg numeric(9, 2) check (potassium_mg >= 0),
  add column zinc_mg numeric(9, 2) check (zinc_mg >= 0),
  add column vitamin_b12_mcg numeric(9, 2) check (vitamin_b12_mcg >= 0),
  add column vitamin_c_mg numeric(9, 2) check (vitamin_c_mg >= 0),
  add column vitamin_a_mcg numeric(9, 2) check (vitamin_a_mcg >= 0),
  add column folate_mcg numeric(9, 2) check (folate_mcg >= 0);

-- 5. Rebuild search_foods function to return the full micronutrient suite
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
  fiber_g_per_100g numeric,
  iron_mg_per_100g numeric,
  potassium_mg_per_100g numeric,
  zinc_mg_per_100g numeric,
  vitamin_b12_mcg_per_100g numeric,
  vitamin_c_mg_per_100g numeric,
  vitamin_a_mcg_per_100g numeric,
  folate_mcg_per_100g numeric,
  flagged boolean,
  verified boolean,
  units jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  q text := lower(left(btrim(regexp_replace(coalesce(query, ''), '\s+', ' ', 'g')), 64));
  pattern text;
  words text[];
  prefix_q tsquery;
  exact_q tsquery;
  main_words text[];
  pick_key text;
  pick_terms text[];
  lim integer := least(greatest(coalesce(max_results, 20), 1), 50);
begin
  if char_length(q) < 2 then
    return;
  end if;

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  words := array(
    select w from unnest(regexp_split_to_array(regexp_replace(q, '[^[:alnum:]]+', ' ', 'g'), ' ')) as w
    where w <> ''
  );
  main_words := array[q, q || 's', q || 'es'];
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
           case when f.name ~* '\m(dried|dry|dehydrated|powder|powdered)\M' then 1 else 0 end as dried,
           char_length(f.name) - char_length(replace(f.name, ',', '')) as qualifiers,
           (ts_rank_cd(f.search, prefix_q)
             + case when f.main_word = any(main_words) then 3 else 0 end
             + case when lower(btrim(split_part(f.name, ',', 2))) = any(main_words) then 2 else 0 end
             + case when f.search @@ exact_q then 1 else 0 end
             + case when lower(f.name) like q || '%' then 0.5 else 0 end)::double precision as score
    from public.usda_foods f
    where prefix_q is not null and f.search @@ prefix_q
      and not exists (select 1 from picks where picks.fdc_id = f.fdc_id or picks.name = f.name)
  ),
  usda_typos as (
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
    coalesce(m.calcium_mg_per_100g, k.calcium_mg_per_100g, f.calcium_mg_per_100g),
    coalesce(m.magnesium_mg_per_100g, k.magnesium_mg_per_100g, f.magnesium_mg_per_100g),
    coalesce(m.vitamin_d_mcg_per_100g, k.vitamin_d_mcg_per_100g, f.vitamin_d_mcg_per_100g),
    coalesce(m.fiber_g_per_100g, k.fiber_g_per_100g, f.fiber_g_per_100g),
    coalesce(m.iron_mg_per_100g, k.iron_mg_per_100g, f.iron_mg_per_100g),
    coalesce(m.potassium_mg_per_100g, k.potassium_mg_per_100g, f.potassium_mg_per_100g),
    coalesce(m.zinc_mg_per_100g, k.zinc_mg_per_100g, f.zinc_mg_per_100g),
    coalesce(m.vitamin_b12_mcg_per_100g, k.vitamin_b12_mcg_per_100g, f.vitamin_b12_mcg_per_100g),
    coalesce(m.vitamin_c_mg_per_100g, k.vitamin_c_mg_per_100g, f.vitamin_c_mg_per_100g),
    coalesce(m.vitamin_a_mcg_per_100g, k.vitamin_a_mcg_per_100g, f.vitamin_a_mcg_per_100g),
    coalesce(m.folate_mcg_per_100g, k.folate_mcg_per_100g, f.folate_mcg_per_100g),
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
