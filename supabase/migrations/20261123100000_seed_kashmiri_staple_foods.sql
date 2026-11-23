-- Seed the first staple Kashmiri foods (SHU-10, asked for by Tajamul Wani on 23 November 2026).
-- Values are per 100 g as eaten, calculated from raw cited ingredients with cooking yields and
-- moisture loss factored in. Verified with Atwater sanity checks.

insert into public.kashmiri_foods (
  id, name, aliases, category,
  kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, sodium_mg_per_100g,
  source, source_ref, verified
) values
(
  'c0000000-0000-0000-0000-000000000001',
  'Girda',
  array['czot', 'tandoor czot'],
  'Breads',
  264.00, 7.20, 53.50, 0.80, 310.00,
  'Calculated from recipe (wheat flour, yeast, water, salt; tandoor baked)',
  'Refined wheat flour (FDC 168936, 100 g), active dry yeast (FDC 174415, 1 g), salt (1.2 g), water (60 g). Baked yield 138 g per 100 g flour. Crumb moisture ~33%. 1 piece ~95 g.',
  false
),
(
  'c0000000-0000-0000-0000-000000000002',
  'Haakh',
  array['kashmiri haakh', 'haak'],
  'Vegetables',
  56.00, 2.50, 4.50, 3.80, 274.00,
  'Calculated from recipe (collard greens, mustard oil, salt, water)',
  'Collard greens raw (FDC 170406, 500 g), mustard oil (20 g), salt (4 g), water (400 g). Simmered to cooked yield of 600 g greens with ras.',
  false
),
(
  'c0000000-0000-0000-0000-000000000003',
  'Nun chai',
  array['noon chai', 'sheer chai'],
  'Beverages',
  31.00, 1.60, 2.40, 1.60, 194.00,
  'Calculated from recipe (green tea, whole milk, sodium bicarbonate, salt, water)',
  'Green tea leaves (10 g), sodium bicarbonate (1.5 g), whole cow milk (FDC 171265, 400 g), salt (2.5 g), water (400 g). Aerated and simmered to 800 g yield (4 cups).',
  false
),
(
  'c0000000-0000-0000-0000-000000000004',
  'Kehva',
  array['kahwa', 'kashmiri kahwa', 'qehwa'],
  'Beverages',
  22.00, 0.40, 3.30, 1.00, 1.00,
  'Calculated from recipe (green tea, saffron, cardamom, cinnamon, sugar, almonds)',
  'Water (800 g), green tea (8 g), spices and saffron, sugar (FDC 169655, 24 g), almonds slivered (FDC 170567, 16 g). Yield 840 g (4 cups with 4 g almonds each).',
  false
);

insert into public.food_units (food_id, unit_name, grams) values
('c0000000-0000-0000-0000-000000000001', '1 piece', 95.00),
('c0000000-0000-0000-0000-000000000001', '1/2 piece', 47.50),
('c0000000-0000-0000-0000-000000000002', '1 katori', 150.00),
('c0000000-0000-0000-0000-000000000002', '1 serving', 180.00),
('c0000000-0000-0000-0000-000000000003', '1 cup', 200.00),
('c0000000-0000-0000-0000-000000000003', '1 small cup (finjan)', 150.00),
('c0000000-0000-0000-0000-000000000004', '1 cup', 200.00),
('c0000000-0000-0000-0000-000000000004', '1 small cup (finjan)', 150.00);

-- Update the everyday pick for banana/kela to point to the modern store-bought banana
-- ("Bananas, ripe and slightly ripe, raw", FDC 1105314) and add standard USDA size portions.
update public.search_picks
  set fdc_id = 1105314
  where term in ('banana', 'kela');

insert into public.usda_portions (fdc_id, unit_name, grams) values
(1105314, '1 small', 101.00),
(1105314, '1 medium', 118.00),
(1105314, '1 large', 136.00),
(1105314, '1 extra large', 152.00)
on conflict do nothing;
