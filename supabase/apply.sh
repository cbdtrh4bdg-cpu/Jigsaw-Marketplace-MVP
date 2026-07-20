#!/usr/bin/env bash
# Apply all migrations then seed. Targets DIRECT_DB_URL (a direct Postgres
# connection). For a hosted Supabase project, prefer the Supabase CLI
# (`supabase db reset`) which runs supabase/migrations/*.sql in order; this
# script is a CLI-free equivalent for local/psql use.
set -euo pipefail
: "${DIRECT_DB_URL:?Set DIRECT_DB_URL to your Postgres connection string}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in "$DIR"/migrations/*.sql; do
  echo "==> applying $(basename "$f")"
  psql "$DIRECT_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "==> seeding"
psql "$DIRECT_DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/seed.sql"
echo "Done."
