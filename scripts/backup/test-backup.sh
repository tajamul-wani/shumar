#!/usr/bin/env bash
# The round trip, on the local stack: write a few rows a person would have, back them up, wipe
# them, restore the backup, and check every row came back exactly. Runs in CI with `npm run test:backup`.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. scripts/backup/lib.sh
need gpg tar awk psql

db_url="$(local_db_url)"
export BACKUP_PASSPHRASE='round-trip-test-passphrase-not-a-secret'
export BACKUP_DIR
BACKUP_DIR="$(mktemp -d)"
trap 'rm -rf "$BACKUP_DIR"; run_psql "$db_url" -c "delete from auth.users where email like '"'"'%@backup-test.local'"'"'; delete from public.kashmiri_foods where source = '"'"'Backup round-trip fixture'"'"'" >/dev/null' EXIT

user=bac0bac0-0000-4000-8000-000000000001
food=bac0bac0-0000-4000-8000-000000000002
run_psql "$db_url" <<SQL
insert into auth.users (id, email) values ('$user', 'person@backup-test.local');
insert into public.profiles (user_id, age_years, sex, weight_kg, height_cm, activity, goal)
  values ('$user', 31, 'female', 62.5, 160, 'light', 'maintain');
insert into public.kashmiri_foods (id, name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, source)
  values ('$food', 'Round-trip girda', 'bread', 250, 8, 50, 2, 'Backup round-trip fixture');
insert into public.food_units (food_id, unit_name, grams) values ('$food', 'piece', 90);
insert into public.user_logs (user_id, log_date, meal, food_name, food_source, food_source_id, quantity, unit_name, grams, kcal, protein, carbs, fat, sodium_mg)
  values ('$user', '2026-10-26', 'breakfast', 'Round-trip girda', 'kashmiri', '$food', 1, 'piece', 90, 225, 7.2, 45, 1.8, 0),
         ('$user', '2026-10-26', 'chai', 'Round-trip girda', 'kashmiri', '$food', 0.5, 'piece', 45, 112.5, 3.6, 22.5, 0.9, 0);
SQL
before="$(run_psql "$db_url" -Atc "select count(*) from public.user_logs where user_id = '$user'")"
[ "$before" = 2 ] || { echo "The fixture did not go in." >&2; exit 1; }

bash scripts/backup/backup.sh --local
file="$(ls "$BACKUP_DIR"/*.tar.gpg)"

echo "Wiping the rows, as a lost database would..."
run_psql "$db_url" -c "delete from auth.users where id = '$user'; delete from public.kashmiri_foods where id = '$food'"
[ "$(run_psql "$db_url" -Atc "select count(*) from public.user_logs where user_id = '$user'")" = 0 ]

bash scripts/backup/restore.sh "$file" --local

check() {
  local got
  got="$(run_psql "$db_url" -Atc "$1")"
  if [ "$got" != "$2" ]; then
    echo "After the restore, '$1' gave '$got', expected '$2'." >&2
    exit 1
  fi
}
check "select email from auth.users where id = '$user'" person@backup-test.local
check "select weight_kg from public.profiles where user_id = '$user'" 62.500
check "select count(*) from public.user_logs where user_id = '$user'" 2
check "select sum(kcal) from public.user_logs where user_id = '$user'" 337.50
check "select meal from public.user_logs where user_id = '$user' and quantity = 0.5" chai
check "select grams from public.food_units where food_id = '$food'" 90.00
echo "Round trip passed: every row came back as it was."
