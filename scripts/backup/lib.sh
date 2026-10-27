#!/usr/bin/env bash
# Shared by backup.sh, restore.sh and test-backup.sh. Source it, don't run it.

# The schemas a backup holds: people's accounts (auth) and the app's own tables (public). Shumār
# stores no files, so the storage schema stays out, as do the platform's own schemas.
SCHEMAS='auth,public'

# Tables left out of the data dump. The USDA tables and the search words are written by the
# migrations, so a restore gets them from `supabase db push` or `supabase db reset`; the auth
# tables here hold sign-in sessions and audit noise, which nobody needs back (people sign in again).
EXCLUDED_TABLES='public.usda_foods,public.usda_portions,public.usda_releases,public.search_synonyms,auth.audit_log_entries,auth.flow_state,auth.sessions,auth.refresh_tokens,auth.mfa_amr_claims,auth.one_time_tokens'

MIN_PASSPHRASE_LENGTH=24

need() {
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || {
      echo "This needs '$tool', which is not installed (on Ubuntu: sudo apt install $tool)." >&2
      exit 1
    }
  done
}

# The passphrase the backups are encrypted with: BACKUP_PASSPHRASE in the environment, else a line
# in .env.local, else typed in at the terminal, hidden. Never a flag, so it never shows in a process
# list or a shell history. Kept only in the password manager, it never sits beside the backups.
load_passphrase() {
  local pass="${BACKUP_PASSPHRASE:-}"
  if [ -z "$pass" ] && [ -f .env.local ]; then
    pass="$(grep -E '^BACKUP_PASSPHRASE=' .env.local | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')"
  fi
  if [ -z "$pass" ] && (exec </dev/tty) 2>/dev/null; then
    printf 'Backup passphrase (from the password manager; nothing shows as you type): ' >/dev/tty
    IFS= read -rs pass </dev/tty || pass=''
    printf '\n' >/dev/tty
  fi
  if [ -z "$pass" ]; then
    echo "No passphrase. Run this in a terminal to type it in, or set BACKUP_PASSPHRASE." >&2
    exit 1
  fi
  if [ "${#pass}" -lt "$MIN_PASSPHRASE_LENGTH" ]; then
    echo "The passphrase must be at least $MIN_PASSPHRASE_LENGTH characters. A backup holds people's private data." >&2
    exit 1
  fi
  printf '%s' "$pass"
}

# Lists every table in a data dump with its row count, one "schema.table<TAB>rows" per line.
# pg_dump writes each table as a COPY block that ends with a line holding only a backslash and a dot.
dump_tables() {
  awk '
    /^COPY "/ { table = $2; gsub(/"/, "", table); rows = 0; inside = 1; next }
    inside && /^\\\.$/ { print table "\t" rows; inside = 0; next }
    inside { rows++ }
  ' "$1"
}

# The local stack's database address, from `supabase status`.
local_db_url() {
  local url
  url="$(npx supabase status -o env 2>/dev/null | grep -E '^DB_URL=' | cut -d= -f2- | tr -d '"')"
  if [ -z "$url" ]; then
    echo "The local Supabase stack isn't running. Start it with: npx supabase start" >&2
    exit 1
  fi
  printf '%s' "$url"
}

# Runs psql against a database address with the flags every call here wants.
run_psql() {
  local url="$1"
  shift
  psql "$url" -v ON_ERROR_STOP=1 -q -X "$@"
}
