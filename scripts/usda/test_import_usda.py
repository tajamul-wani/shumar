"""Tests for import_usda.py. They build small fake USDA zip files, so they run offline.

The numbers below are made-up test inputs, not nutrition data.
Run with: python3 -B -m unittest discover -s scripts/usda
"""

import csv
import io
import tempfile
import unittest
import zipfile
from datetime import date
from decimal import Decimal
from pathlib import Path

import import_usda as imp

DATASET = imp.Dataset("test_release", "sr_legacy_food", "test.zip", "0" * 64)


def write_csv(rows: list[dict]) -> str:
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue()


def nutrient(fdc_id: str, number: str, amount: str) -> dict:
    return {"fdc_id": fdc_id, "nutrient_id": number, "amount": amount}


def portion(fdc_id: str, row_id: str, seq: str, amount: str, unit: str, description: str, modifier: str, grams: str) -> dict:
    return {
        "id": row_id, "fdc_id": fdc_id, "seq_num": seq, "amount": amount, "measure_unit_id": unit,
        "portion_description": description, "modifier": modifier, "gram_weight": grams,
    }


def full(fdc_id: str, kcal="100", protein="5", carbs="15", fat="2", sodium="40") -> list[dict]:
    return [
        nutrient(fdc_id, "1008", kcal), nutrient(fdc_id, "1003", protein), nutrient(fdc_id, "1005", carbs),
        nutrient(fdc_id, "1004", fat), nutrient(fdc_id, "1093", sodium),
    ]


def build_zip(folder: Path, foods: list[dict], nutrients: list[dict], portions: list[dict]) -> Path:
    path = folder / "test.zip"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("csv/food.csv", write_csv(foods))
        archive.writestr("csv/food_category.csv", write_csv([
            {"id": "1", "description": "Cereal Grains and Pasta"},
            {"id": "2", "description": "Fast Foods"},
        ]))
        archive.writestr("csv/measure_unit.csv", write_csv([
            {"id": "1000", "name": "cup"}, {"id": "9999", "name": "undetermined"},
        ]))
        archive.writestr("csv/food_nutrient.csv", write_csv(nutrients))
        archive.writestr("csv/food_portion.csv", write_csv(portions or [portion("0", "0", "1", "1", "1000", "", "", "1")]))
    return path


def food(fdc_id: str, name: str, category="1", data_type="sr_legacy_food") -> dict:
    return {"fdc_id": fdc_id, "data_type": data_type, "description": name, "food_category_id": category, "publication_date": ""}


class LoadDatasetTest(unittest.TestCase):
    def load(self, foods, nutrients, portions=()):
        with tempfile.TemporaryDirectory() as folder:
            summary = imp.Summary()
            path = build_zip(Path(folder), foods, nutrients, list(portions))
            return {f.fdc_id: f for f in imp.load_dataset(path, DATASET, summary)}, summary

    def test_keeps_a_complete_food_with_its_values_per_100_g(self):
        foods, summary = self.load([food("1", "Rice, test")], full("1"))
        self.assertEqual(summary.kept, 1)
        self.assertEqual(
            (foods[1].kcal, foods[1].protein, foods[1].carbs, foods[1].fat, foods[1].sodium_mg),
            (Decimal("100.00"), Decimal("5.00"), Decimal("15.00"), Decimal("2.00"), Decimal("40.00")),
        )
        self.assertEqual((foods[1].name, foods[1].category, foods[1].release_id), ("Rice, test", "Cereal Grains and Pasta", "test_release"))

    def test_energy_falls_back_to_specific_then_general_atwater(self):
        nutrients = [n for n in full("1") if n["nutrient_id"] != "1008"] + [nutrient("1", "2048", "98"), nutrient("1", "2047", "97")]
        nutrients += [n for n in full("2") if n["nutrient_id"] != "1008"] + [nutrient("2", "2047", "97")]
        foods, _ = self.load([food("1", "A"), food("2", "B")], nutrients)
        self.assertEqual((foods[1].kcal, foods[2].kcal), (Decimal("98.00"), Decimal("97.00")))

    def test_carbs_fall_back_to_by_summation(self):
        nutrients = [n for n in full("1") if n["nutrient_id"] != "1005"] + [nutrient("1", "1050", "14")]
        foods, _ = self.load([food("1", "A")], nutrients)
        self.assertEqual(foods[1].carbs, Decimal("14.00"))

    def test_leaves_out_missing_values_instead_of_filling_them_in(self):
        nutrients = [n for n in full("1") if n["nutrient_id"] != "1093"] + [n for n in full("2") if n["nutrient_id"] != "1003"]
        foods, summary = self.load([food("1", "No sodium"), food("2", "No protein")], nutrients)
        self.assertEqual((foods, summary.missing_value), ({}, 2))

    def test_leaves_out_us_only_categories_and_other_data_types(self):
        nutrients = full("1") + full("2")
        foods, summary = self.load([food("1", "Burger", category="2"), food("2", "Sample", data_type="sample_food")], nutrients)
        self.assertEqual((foods, summary.excluded_category), ({}, 1))

    def test_leaves_out_values_out_of_range(self):
        foods, summary = self.load([food("1", "A"), food("2", "B")], full("1", kcal="1200") + full("2", fat="120"))
        self.assertEqual((foods, summary.out_of_range), ({}, 2))

    def test_stores_carbs_slightly_below_zero_as_zero_and_drops_lower(self):
        foods, summary = self.load([food("1", "A"), food("2", "B")], full("1", carbs="-0.47") + full("2", carbs="-1.5"))
        self.assertEqual((foods[1].carbs, 2 in foods, summary.carbs_clamped, summary.out_of_range), (Decimal("0.00"), False, 1, 1))

    def test_flags_values_that_fail_the_atwater_check(self):
        # 4 x 5 + 4 x 15 + 9 x 2 = 98, close to 100. 4 x 1 + 4 x 1 + 9 x 1 = 17, far from 100.
        foods, summary = self.load([food("1", "A"), food("2", "B")], full("1") + full("2", protein="1", carbs="1", fat="1"))
        self.assertEqual((foods[1].atwater_flag, foods[2].atwater_flag, summary.flagged), (False, True, 1))

    def test_turns_usda_portions_into_readable_units(self):
        portions = [
            portion("1", "11", "1", "1", "9999", "", "cup, chopped", "160"),
            portion("1", "12", "2", "2.0", "1000", "", "", "300.4"),
            portion("1", "13", "3", "1", "9999", "", "cup, chopped", "170"),
            portion("1", "14", "4", "1", "9999", "", "slice", "0"),
        ]
        foods, _ = self.load([food("1", "A")], full("1"), portions)
        self.assertEqual(foods[1].portions, [("1 cup, chopped", Decimal("160.00")), ("2 cup", Decimal("300.40"))])


class AtwaterTest(unittest.TestCase):
    def test_small_foods_get_a_4_kcal_margin(self):
        self.assertFalse(imp.atwater_flag(Decimal(2), Decimal(0), Decimal("1.4"), Decimal(0)))
        self.assertTrue(imp.atwater_flag(Decimal(2), Decimal(0), Decimal("2"), Decimal(0)))


class PortionLabelTest(unittest.TestCase):
    def test_reads_like_a_person_would_say_it(self):
        self.assertEqual(imp.portion_label("1", "undetermined", "", "cup, chopped"), "1 cup, chopped")
        self.assertEqual(imp.portion_label("0.50", "cup", "", "sliced"), "0.5 cup, sliced")
        self.assertEqual(imp.portion_label("1", "undetermined", "", "  medium  (2-3/4\" dia)"), '1 medium (2-3/4" dia)')


class RenderMigrationTest(unittest.TestCase):
    def foods(self):
        return [
            imp.Food(2, "test_release", "Ann's tea", "Beverages", Decimal("1.00"), Decimal("0.00"), Decimal("0.20"), Decimal("0.00"), Decimal("3.00"), False, [("1 cup", Decimal("240.00"))]),
            imp.Food(1, "test_release", "Rice", "Grains", Decimal("130.00"), Decimal("2.70"), Decimal("28.00"), Decimal("0.30"), Decimal("1.00"), True),
        ]

    def render(self):
        return imp.render_migration(self.foods(), [(DATASET, "a" * 64)], date(2026, 10, 21), imp.Summary(kept=2, flagged=1))

    def test_escapes_quotes_and_sorts_by_fdc_id(self):
        sql = self.render()
        self.assertIn("'Ann''s tea'", sql)
        self.assertLess(sql.index("(1, 'test_release', 'Rice'"), sql.index("(2, 'test_release', 'Ann''s tea'"))
        self.assertIn("(2, '1 cup', 240.00)", sql)
        self.assertIn(f"'{'a' * 64}', '2026-10-21'", sql)

    def test_the_same_input_always_gives_the_same_file(self):
        self.assertEqual(self.render(), self.render())

    def test_replaces_the_previous_import(self):
        sql = self.render()
        self.assertLess(sql.index("delete from public.usda_portions;"), sql.index("insert into public.usda_releases"))


class FetchTest(unittest.TestCase):
    def test_stops_when_a_download_does_not_match_its_pinned_sha256(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / DATASET.file_name).write_bytes(b"not the real file")
            with self.assertRaises(SystemExit) as stop:
                imp.fetch(DATASET, Path(folder))
            self.assertIn("expected", str(stop.exception))


if __name__ == "__main__":
    unittest.main()
