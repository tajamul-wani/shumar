-- A person's own foods, added from a pack's label when search can't find them (SHU-31). They are
-- private to the person who adds them (Tajamul Wani, 28 October 2026); one reaches the shared
-- foods only through the admin's review against a photo of its label (SHU-37), never from here.
--
-- The values are kept as the label prints them, per 100 g or per serving, so the person can check
-- them against the pack later. Every calculation uses the per-100 g values worked out from them.
create table public.my_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (
    char_length(name) between 1 and 80
    and name = btrim(name)
    and name !~ '[\n\r\t]'
  ),
  brand text check (
    brand is null or (
      char_length(brand) between 1 and 60
      and brand = btrim(brand)
      and brand !~ '[\n\r\t]'
    )
  ),
  -- What the label's values are for: 100 g, or one serving of serving_grams.
  label_basis text not null check (label_basis in ('100g', 'serving')),
  serving_grams numeric(7, 2) check (serving_grams > 0 and serving_grams <= 5000),
  kcal numeric(8, 2) not null check (kcal >= 0),
  protein numeric(7, 2) not null check (protein >= 0),
  carbs numeric(7, 2) not null check (carbs >= 0),
  fat numeric(7, 2) not null check (fat >= 0),
  sodium_mg numeric(9, 2) not null check (sodium_mg >= 0),
  created_at timestamptz not null default now(),
  -- How the food reads in search and in a log: "Paneer, full fat (Amul)".
  display_name text generated always as (
    case when brand is null then name else name || ' (' || brand || ')' end
  ) stored,
  kcal_per_100g numeric generated always as (round(kcal * 100 / coalesce(serving_grams, 100), 4)) stored,
  protein_per_100g numeric generated always as (round(protein * 100 / coalesce(serving_grams, 100), 4)) stored,
  carbs_per_100g numeric generated always as (round(carbs * 100 / coalesce(serving_grams, 100), 4)) stored,
  fat_per_100g numeric generated always as (round(fat * 100 / coalesce(serving_grams, 100), 4)) stored,
  sodium_mg_per_100g numeric generated always as (round(sodium_mg * 100 / coalesce(serving_grams, 100), 4)) stored,
  -- A serving size exactly when the label gives its values per serving.
  constraint my_foods_serving check ((label_basis = 'serving') = (serving_grams is not null)),
  -- Per 100 g, the limits every food meets: up to 1,000 kcal, protein, carbs and fat that weigh no
  -- more than the food itself, and up to 40 g of sodium.
  constraint my_foods_per_100g check (
    kcal * 100 <= 1000 * coalesce(serving_grams, 100)
    and protein + carbs + fat <= coalesce(serving_grams, 100)
    and sodium_mg * 100 <= 40000 * coalesce(serving_grams, 100)
  )
);

comment on table public.my_foods is 'A person''s own foods, as their pack labels give them. Each user can only ever see and change their own rows.';

-- One food of a name and brand each, whatever the letter case. It also serves lookups by person.
create unique index my_foods_one_name_each on public.my_foods (user_id, lower(name), lower(coalesce(brand, '')));

alter table public.my_foods enable row level security;

-- Signed-in users read, add, change and remove their own foods. Signed-out visitors get nothing.
revoke all on public.my_foods from anon, authenticated;
grant select, insert, update, delete on public.my_foods to authenticated;

create policy "own foods: select" on public.my_foods
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own foods: insert" on public.my_foods
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own foods: update" on public.my_foods
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own foods: delete" on public.my_foods
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Up to 500 foods of one's own, checked like the other limits (SHU-34): under a lock on the person,
-- counting rows earlier in the same statement, and skipped by restores, which load in replica mode.
create function public.check_my_food_limits() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('shumar-limits:' || new.user_id::text, 0));
  if (select count(*) from public.my_foods where user_id = new.user_id) >= 500 then
    raise exception 'One account holds up to 500 of its own foods.' using errcode = 'SH005';
  end if;
  return new;
end;
$$;

create trigger my_foods_limits before insert on public.my_foods
  for each row execute function public.check_my_food_limits();

revoke all on function public.check_my_food_limits() from public, anon, authenticated;

-- A logged food and a food in a saved meal can come from the person's own foods.
alter table public.user_logs drop constraint user_logs_food_source_check;
alter table public.user_logs add constraint user_logs_food_source_check
  check (food_source in ('kashmiri', 'mine', 'off', 'usda'));
alter table public.saved_meal_foods drop constraint saved_meal_foods_food_source_check;
alter table public.saved_meal_foods add constraint saved_meal_foods_food_source_check
  check (food_source in ('kashmiri', 'mine', 'usda'));

-- ---------------------------------------------------------------------------
-- Search, as before, with the person's own foods first. Row-level security leaves only theirs:
-- the function runs with the caller's rights. Their values are checked like every other food's,
-- so a food whose calories are more than 20% off its protein, carbs and fat is marked.
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
  -- own_id is the id of one of our own rows: a food of the person's own, or a Kashmiri catalog food.
  with mine as (
    select 'mine'::text as source, m.id as own_id, null::integer as fdc_id, m.display_name as name,
           -1 as tier, 0 as qualifiers,
           extensions.similarity(lower(m.display_name), q)::double precision as score
    from public.my_foods m
    where lower(m.display_name) like pattern
       or extensions.similarity(lower(m.display_name), q) > 0.3
  ),
  kashmiri as (
    select 'kashmiri'::text as source, k.id as own_id, null::integer as fdc_id, k.name,
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
    select 'usda'::text as source, null::uuid as own_id, f.fdc_id, f.name,
           1 as tier, 0 as qualifiers,
           (10 - min(p.position))::double precision as score
    from public.search_picks p
    join public.usda_foods f on f.fdc_id = p.fdc_id
    where p.term = any(pick_terms)
    group by f.fdc_id, f.name
  ),
  usda_words as (
    select 'usda'::text as source, null::uuid as own_id, f.fdc_id, f.name,
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
    select 'usda'::text as source, null::uuid as own_id, f.fdc_id, f.name,
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
    order by u.tier, u.score desc, u.qualifiers, char_length(u.name), u.name
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
  order by t.tier, t.score desc, t.qualifiers, char_length(t.name), t.name;
end;
$$;

comment on function public.search_foods(text, integer) is
  'Searches the person''s own foods, the Kashmiri catalog, the everyday picks, then USDA foods. At most 50 results, values per 100 g.';

-- Replacing the function keeps its privileges; set them again so this file says them in full.
revoke all on function public.search_foods(text, integer) from public, anon, authenticated;
grant execute on function public.search_foods(text, integer) to authenticated;
