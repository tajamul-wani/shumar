#!/usr/bin/env python3
"""Turn the USDA FoodData Central bulk downloads into a Shumār data migration.

USDA FoodData Central data is public domain (CC0). This script uses only the Python
standard library. Downloads are cached in .cache/usda/ and must match the SHA-256 pinned
below, so a changed or tampered file stops the import instead of loading silently.

Every value is taken from USDA as published. Foods missing calories, protein, carbs, fat or
sodium are left out, never filled in. Foods whose Atwater check is off are kept and flagged.
Carbohydrate "by difference" slightly below zero (down to -1 g) is a side effect of how USDA
calculates it (100 g minus water, protein, fat and ash), so it is stored as 0 and counted.

Usage:
    python3 scripts/usda/import_usda.py supabase/migrations/<timestamp>_usda_foods_data.sql

When USDA publishes a new Foundation Foods release, update DATASETS (file name and SHA-256),
run this again into a new migration, and update the expected count in
supabase/tests/database/usda_data.test.sql.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import sys
import urllib.request
import zipfile
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

BASE_URL = "https://fdc.nal.usda.gov/fdc-datasets/"


@dataclass(frozen=True)
class Dataset:
    release_id: str
    data_type: str
    file_name: str
    sha256: str


DATASETS = (
    Dataset(
        "foundation_food_2026-04-30",
        "foundation_food",
        "FoodData_Central_foundation_food_csv_2026-04-30.zip",
        "70457ee9d9342f43bda2010318c85f04210c689fdeb9cd2da4c513b0e8dbc655",
    ),
    Dataset(
        "sr_legacy_food_2018-04",
        "sr_legacy_food",
        "FoodData_Central_sr_legacy_food_csv_2018-04.zip",
        "b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0",
    ),
)

# US-only categories that would only add noise to searches in Kashmir (decided 21 October 2026).
EXCLUDED_CATEGORIES = frozenset(
    {
        "Baby Foods",
        "Fast Foods",
        "Restaurant Foods",
        "Meals, Entrees, and Side Dishes",
        "American Indian/Alaska Native Foods",
    }
)

# USDA nutrient numbers. Energy falls back from 1008 to the Atwater values USDA gives instead
# (2048 uses food-specific factors, so it comes before the general 2047). Carbohydrate falls
# back from "by difference" (1005) to "by summation" (1050). Sodium (1093) is already in mg.
NUTRIENTS = {
    "1008": "kcal",
    "2048": "kcal_specific",
    "2047": "kcal_general",
    "1003": "protein",
    "1004": "fat",
    "1005": "carbs",
    "1050": "carbs_summation",
    "1093": "sodium_mg",
}

MAX_KCAL = 1000
# Carbs by difference between this and 0 are a calculation artifact and are stored as 0.
MIN_CARBS_BY_DIFFERENCE = -1.0
MAX_GRAMS = 100
MAX_SODIUM_MG = 40000
MAX_PORTION_GRAMS = 5000
MAX_NAME = 200
MAX_UNIT = 60
BATCH = 500


@dataclass
class Food:
    fdc_id: int
    release_id: str
    name: str
    category: str
    kcal: Decimal
    protein: Decimal
    carbs: Decimal
    fat: Decimal
    sodium_mg: Decimal
    atwater_flag: bool
    portions: list[tuple[str, Decimal]] = field(default_factory=list)


@dataclass
class Summary:
    kept: int = 0
    excluded_category: int = 0
    missing_value: int = 0
    out_of_range: int = 0
    flagged: int = 0
    carbs_clamped: int = 0


def two_places(value: float | str) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def atwater_flag(kcal: Decimal, protein: Decimal, carbs: Decimal, fat: Decimal) -> bool:
    """True when 4 x protein + 4 x carbs + 9 x fat is more than 20% (at least 4 kcal) off."""
    estimate = 4 * protein + 4 * carbs + 9 * fat
    return abs(estimate - kcal) > max(Decimal("0.20") * kcal, Decimal(4))


def clean_amount(raw: str) -> str:
    value = Decimal(raw).normalize()
    return format(value, "f")


def portion_label(amount: str, unit: str, description: str, modifier: str) -> str:
    """A readable USDA portion, such as "1 cup, chopped" or "2 tablespoon"."""
    words = [clean_amount(amount)]
    if unit and unit != "undetermined":
        words.append(unit)
    extra = ", ".join(part.strip() for part in (description, modifier) if part.strip())
    label = " ".join(words)
    if extra:
        label = f"{label}, {extra}" if unit and unit != "undetermined" else f"{label} {extra}"
    return " ".join(label.split())


def read_csv(archive: zipfile.ZipFile, name: str) -> csv.DictReader:
    path = next(n for n in archive.namelist() if n.split("/")[-1] == name)
    return csv.DictReader(io.TextIOWrapper(archive.open(path), encoding="utf8"))


def load_dataset(path: Path, dataset: Dataset, summary: Summary) -> list[Food]:
    """Reads one USDA zip and returns the foods worth keeping, with their portions."""
    with zipfile.ZipFile(path) as archive:
        categories = {row["id"]: row["description"] for row in read_csv(archive, "food_category.csv")}
        units = {row["id"]: row["name"] for row in read_csv(archive, "measure_unit.csv")}
        candidates = {}
        for row in read_csv(archive, "food.csv"):
            if row["data_type"] != dataset.data_type:
                continue
            category = categories.get(row["food_category_id"], "")
            if category in EXCLUDED_CATEGORIES:
                summary.excluded_category += 1
                continue
            candidates[row["fdc_id"]] = (row["description"].strip(), category)

        values: dict[str, dict[str, float]] = {fdc_id: {} for fdc_id in candidates}
        for row in read_csv(archive, "food_nutrient.csv"):
            key = NUTRIENTS.get(row["nutrient_id"])
            if key and row["fdc_id"] in values and row["amount"] != "":
                values[row["fdc_id"]][key] = float(row["amount"])

        foods: dict[str, Food] = {}
        for fdc_id, (name, category) in candidates.items():
            v = values[fdc_id]
            kcal = v.get("kcal", v.get("kcal_specific", v.get("kcal_general")))
            carbs = v.get("carbs", v.get("carbs_summation"))
            raw = (kcal, v.get("protein"), carbs, v.get("fat"), v.get("sodium_mg"))
            if any(x is None for x in raw) or not name or not category:
                summary.missing_value += 1
                continue
            if MIN_CARBS_BY_DIFFERENCE <= raw[2] < 0:
                raw = (raw[0], raw[1], 0.0, raw[3], raw[4])
                summary.carbs_clamped += 1
            kcal_d, protein_d, carbs_d, fat_d, sodium_d = (two_places(x) for x in raw)
            in_range = (
                0 <= kcal_d <= MAX_KCAL
                and all(0 <= x <= MAX_GRAMS for x in (protein_d, carbs_d, fat_d))
                and 0 <= sodium_d <= MAX_SODIUM_MG
                and len(name) <= MAX_NAME
            )
            if not in_range:
                summary.out_of_range += 1
                continue
            flag = atwater_flag(kcal_d, protein_d, carbs_d, fat_d)
            summary.flagged += flag
            foods[fdc_id] = Food(
                int(fdc_id), dataset.release_id, name, category,
                kcal_d, protein_d, carbs_d, fat_d, sodium_d, flag,
            )

        seen: set[tuple[str, str]] = set()
        portion_rows = sorted(
            (row for row in read_csv(archive, "food_portion.csv") if row["fdc_id"] in foods),
            key=lambda row: (int(row["fdc_id"]), int(row["seq_num"] or 0), int(row["id"])),
        )
        for row in portion_rows:
            if not row["amount"] or not row["gram_weight"]:
                continue
            if Decimal(row["amount"]) <= 0:
                continue
            grams = two_places(row["gram_weight"])
            label = portion_label(
                row["amount"], units.get(row["measure_unit_id"], ""), row["portion_description"], row["modifier"]
            )
            key = (row["fdc_id"], label)
            if not 0 < grams <= MAX_PORTION_GRAMS or len(label) > MAX_UNIT or key in seen:
                continue
            seen.add(key)
            foods[row["fdc_id"]].portions.append((label, grams))

    summary.kept += len(foods)
    return list(foods.values())


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def render_migration(foods: list[Food], files: list[tuple[Dataset, str]], imported_on: date, summary: Summary) -> str:
    """The data migration. The same input always gives the same file."""
    foods = sorted(foods, key=lambda f: f.fdc_id)
    portions = [(f.fdc_id, label, grams) for f in foods for label, grams in f.portions]
    lines = [
        "-- USDA FoodData Central foods, generated by scripts/usda/import_usda.py. Do not edit by hand.",
        "-- Source: USDA FoodData Central, public domain (CC0), https://fdc.nal.usda.gov",
    ]
    lines += [f"-- {d.release_id}: {d.file_name}, SHA-256 {sha}" for d, sha in files]
    lines += [
        f"-- Kept {summary.kept} foods with {len(portions)} portions. Left out: {summary.excluded_category} in US-only",
        f"-- categories, {summary.missing_value} with a missing value, {summary.out_of_range} out of range.",
        f"-- Flagged by the Atwater check: {summary.flagged}. Carbs slightly below zero stored as 0: {summary.carbs_clamped}.",
        "",
        "delete from public.usda_portions;",
        "delete from public.usda_foods;",
        "delete from public.usda_releases;",
        "",
        "insert into public.usda_releases (id, dataset, file_name, file_sha256, imported_on) values",
        ",\n".join(
            f"  ({sql_text(d.release_id)}, {sql_text(d.data_type)}, {sql_text(d.file_name)}, {sql_text(sha)}, '{imported_on.isoformat()}')"
            for d, sha in files
        )
        + ";",
    ]
    for start in range(0, len(foods), BATCH):
        lines += [
            "",
            "insert into public.usda_foods (fdc_id, release_id, name, category, kcal_per_100g, protein_per_100g,"
            " carbs_per_100g, fat_per_100g, sodium_mg_per_100g, atwater_flag) values",
            ",\n".join(
                f"  ({f.fdc_id}, {sql_text(f.release_id)}, {sql_text(f.name)}, {sql_text(f.category)}, {f.kcal}, "
                f"{f.protein}, {f.carbs}, {f.fat}, {f.sodium_mg}, {'true' if f.atwater_flag else 'false'})"
                for f in foods[start : start + BATCH]
            )
            + ";",
        ]
    for start in range(0, len(portions), BATCH):
        lines += [
            "",
            "insert into public.usda_portions (fdc_id, unit_name, grams) values",
            ",\n".join(f"  ({fdc_id}, {sql_text(label)}, {grams})" for fdc_id, label, grams in portions[start : start + BATCH])
            + ";",
        ]
    return "\n".join(lines) + "\n"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(dataset: Dataset, cache: Path) -> tuple[Path, str]:
    """Returns the cached download, fetching it first if needed, after checking its SHA-256."""
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / dataset.file_name
    if not path.exists():
        partial = path.with_suffix(".part")
        with urllib.request.urlopen(BASE_URL + dataset.file_name, timeout=120) as response, partial.open("wb") as out:
            while chunk := response.read(1 << 20):
                out.write(chunk)
        partial.rename(path)
    sha = sha256_of(path)
    if sha != dataset.sha256:
        raise SystemExit(
            f"{dataset.file_name} has SHA-256 {sha}, expected {dataset.sha256}. "
            "Delete it from the cache and check the USDA release before changing the pin."
        )
    return path, sha


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("output", type=Path, help="the migration file to write")
    parser.add_argument("--cache", type=Path, default=Path(".cache/usda"), help="where downloads are kept")
    parser.add_argument("--imported-on", type=date.fromisoformat, default=date.today())
    args = parser.parse_args(argv)

    summary = Summary()
    foods: list[Food] = []
    files = []
    for dataset in DATASETS:
        path, sha = fetch(dataset, args.cache)
        files.append((dataset, sha))
        foods += load_dataset(path, dataset, summary)

    args.output.write_text(render_migration(foods, files, args.imported_on, summary), encoding="utf8")
    print(
        f"Wrote {args.output}: {summary.kept} foods kept, {summary.excluded_category} in US-only categories, "
        f"{summary.missing_value} with a missing value, {summary.out_of_range} out of range, "
        f"{summary.flagged} flagged by the Atwater check, {summary.carbs_clamped} with carbs slightly below zero stored as 0."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
