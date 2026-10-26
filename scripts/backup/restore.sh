#!/usr/bin/env bash
# Loads a backup written by backup.sh into a database whose schema is already in place:
#
#   npm run restore -- <file.tar.gpg> --local          into the local stack (after `npx supabase db reset`)
#   npm run restore -- <file.tar.gpg> --db-url <url>   into a fresh hosted project (after `npx supabase db push`)
#
# Into the local stack it empties every table in the backup first, so the round-trip test can run
# on a stack that already holds rows. Into a hosted project it refuses unless the people's tables are
# empty, and empties only the catalog tables, which the migrations seed. The whole load is one
# transaction, and afterwards every table's row count is checked against the backup's.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. scripts/backup/lib.sh

usage() { sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; }

file=""
mode=""
db_url=""
while [ $# -gt 0 ]; do
  case "$1" in
    --local) mode=local ;;
    --db-url) mode=hosted; db_url="$2"; shift ;;
    -h | --help) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) file="$1" ;;
  esac
  shift
done
if [ -z "$file" ] || [ -z "$mode" ]; then
  usage >&2
  exit 2
fi
[ -f "$file" ] || { echo "No such file: $file" >&2; exit 1; }

need gpg tar awk psql
pass="$(load_passphrase)"
umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

gpg --batch --quiet --decrypt --pinentry-mode loopback --passphrase-fd 3 "$file" 3<<<"$pass" | tar -x -C "$tmp"
echo "Backup:"
sed 's/^/  /' "$tmp/manifest.txt"
echo

tables="$(dump_tables "$tmp/data.sql")"
[ -n "$tables" ] || { echo "The backup holds no tables." >&2; exit 1; }
if [ "$mode" = local ]; then
  db_url="$(local_db_url)"
fi

# Every table in the backup must already exist: the schema comes from the migrations, not the backup.
missing="$(printf '%s\n' "$tables" | cut -f1 | while read -r t; do
  [ "$(run_psql "$db_url" -Atc "select to_regclass('$t') is null")" = f ] || echo "$t"
done)"
if [ -n "$missing" ]; then
  echo "These tables are missing in the target. Apply the migrations first (db reset locally, db push on a project):" >&2
  printf '  %s\n' $missing >&2
  exit 1
fi

if [ "$mode" = hosted ]; then
  people="$(run_psql "$db_url" -Atc "select (select count(*) from auth.users) + (select count(*) from public.profiles) + (select count(*) from public.user_logs)")"
  if [ "$people" != 0 ]; then
    echo "The target already holds people's data ($people rows). A restore only goes into a fresh project." >&2
    exit 1
  fi
  echo "This loads the backup into $(printf '%s' "$db_url" | sed -E 's#//[^@]*@#//<login>@#')."
  read -r -p "Type restore to go on: " word
  [ "$word" = restore ] || { echo "Stopped. Nothing was changed."; exit 1; }
  to_empty="$(printf '%s\n' "$tables" | cut -f1 | grep '^public\.' | paste -sd, -)"
else
  to_empty="$(printf '%s\n' "$tables" | cut -f1 | paste -sd, -)"
fi

{
  echo "set session_replication_role = replica;"
  echo "truncate table $to_empty cascade;"
  cat "$tmp/data.sql"
} > "$tmp/load.sql"
echo "Loading..."
PGOPTIONS='-c client_min_messages=warning' run_psql "$db_url" --single-transaction -o /dev/null -f "$tmp/load.sql"

failed=0
printf '  %-28s %8s %8s\n' table backup now
while IFS=$'\t' read -r table rows; do
  now="$(run_psql "$db_url" -Atc "select count(*) from $table")"
  printf '  %-28s %8s %8s\n' "$table" "$rows" "$now"
  [ "$now" = "$rows" ] || failed=1
done <<<"$tables"
if [ "$failed" = 1 ]; then
  echo "Row counts differ from the backup. Check the output above." >&2
  exit 1
fi
echo "Restored. Sign-in sessions are not part of a backup, so everyone signs in again."
