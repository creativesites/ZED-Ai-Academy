#!/usr/bin/env bash
# Apply every migration in supabase/migrations/ to a fresh local Postgres and
# report which files fail. Requires a Postgres server reachable as PGDATABASE_ADMIN
# (default: the local "postgres" OS user via `su`). Exits non-zero on any failure.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${VERIFY_DB:-zedcheck}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)
run_sql() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f '$1'" 2>&1; }

su postgres -c "dropdb --if-exists $DB && createdb $DB" >/dev/null 2>&1 || { echo "cannot create database $DB"; exit 2; }

out=$(run_sql "$ROOT/scripts/supabase-stubs.sql") || { echo "stub schema failed:"; echo "$out"; exit 2; }

failed=0; total=0
for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
  total=$((total + 1))
  out=$(run_sql "$f")
  if [ $? -ne 0 ]; then
    failed=$((failed + 1))
    echo "FAIL $(basename "$f")"
    echo "$out" | grep -m1 ERROR | sed 's/^/     /'
  fi
done

echo "migrations: $total, failing: $failed"
[ "$failed" -eq 0 ]
