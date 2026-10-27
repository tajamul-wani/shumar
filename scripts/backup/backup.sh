#!/usr/bin/env bash
# Writes an encrypted backup of the hosted database (people's accounts, answers and food logs, and
# the catalog) to a folder outside the repo. Run it weekly:
#
#   npm run backup                 the hosted database, through the Supabase CLI login
#   npm run backup -- --local      the local stack, which the round-trip test uses
#   npm run backup -- --out <dir>  somewhere other than BACKUP_DIR (default: ~/shumar-backups)
#
# The file is a tar of schema.sql, data.sql and manifest.txt, encrypted with AES-256 (gpg) and the
# passphrase from the password manager, typed in when asked (or BACKUP_PASSPHRASE). Nothing about
# the backup is stored on GitHub.
# Restore it with scripts/backup/restore.sh.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
. scripts/backup/lib.sh

usage() { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; }

source_flag=--linked
label=hosted
out_dir="${BACKUP_DIR:-$HOME/shumar-backups}"
while [ $# -gt 0 ]; do
  case "$1" in
    --local) source_flag=--local; label=local ;;
    --out) out_dir="$2"; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

need gpg tar awk
pass="$(load_passphrase)"
umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Dumping the $label database..."
npx supabase db dump "$source_flag" --data-only --use-copy -s "$SCHEMAS" -x "$EXCLUDED_TABLES" -f "$tmp/data.sql"
npx supabase db dump "$source_flag" -f "$tmp/schema.sql"
if ! grep -q '^COPY "' "$tmp/data.sql"; then
  echo "The data dump holds no tables. Nothing was written." >&2
  exit 1
fi

{
  echo "Shumār database backup"
  echo "Taken: $(date -u +'%Y-%m-%d %H:%M UTC')"
  echo "Source: $label"
  echo "Code: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  echo "Last migration: $(ls supabase/migrations | sort | tail -1)"
  echo "Not included (rebuilt by the migrations, or sign-in sessions): $EXCLUDED_TABLES"
  echo
  echo "Rows:"
  dump_tables "$tmp/data.sql" | awk -F'\t' '{ printf "  %-28s %s\n", $1, $2 }'
} > "$tmp/manifest.txt"

mkdir -p "$out_dir"
chmod 700 "$out_dir"
file="$out_dir/shumar-$label-$(date -u +%Y-%m-%d-%H%M).tar.gpg"
tar -C "$tmp" -cf - schema.sql data.sql manifest.txt |
  gpg --batch --yes --quiet --symmetric --cipher-algo AES256 --pinentry-mode loopback --passphrase-fd 3 --output "$file" 3<<<"$pass"

echo
cat "$tmp/manifest.txt"
echo
echo "Written: $file ($(du -h "$file" | cut -f1))"
if [ "$label" = hosted ]; then
  echo "Now copy it to the off-machine store (the encrypted file is safe to upload). Keep the passphrase in the password manager, never beside the file."
fi
