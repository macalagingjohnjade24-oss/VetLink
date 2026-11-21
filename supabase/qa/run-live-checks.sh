#!/usr/bin/env bash
# Runs the whole live 0008 QA cycle in order:
#   teardown -> fixtures -> Storage API checks -> SQL checks (rolled back) -> teardown
# The final teardown runs even when a check fails, so live is left clean.
#
# Usage: bash supabase/qa/run-live-checks.sh [project-ref]
# The project ref falls back to SUPABASE_PROJECT_REF, then to the linked project in
# supabase/.temp/project-ref. The service and anon keys are read from the CLI and
# passed to node without being printed.
set -euo pipefail

cd "$(dirname "$0")/../.."

project_ref="${1:-${SUPABASE_PROJECT_REF:-}}"
if [ -z "$project_ref" ] && [ -f supabase/.temp/project-ref ]; then
  project_ref="$(tr -d '[:space:]' < supabase/.temp/project-ref)"
fi
if [ -z "$project_ref" ]; then
  echo "usage: $0 <project-ref>" >&2
  exit 2
fi

tmp_sql="supabase/qa/.run-$$.sql"

db() { npx --no-install supabase db query --remote="$project_ref" "$@"; }
teardown() { db --yes -f supabase/qa/live-rls-teardown.sql -o json >/dev/null 2>&1; }

cleanup() {
  rm -f "$tmp_sql"
  echo "teardown"
  teardown || echo "teardown failed" >&2
}
trap cleanup EXIT

echo "teardown (before)"
teardown

echo "fixtures"
db --yes -f supabase/qa/live-rls-fixtures.sql -o json >/dev/null 2>&1

keys="$(npx --no-install supabase projects api-keys --project-ref "$project_ref" -o json 2>/dev/null)"
key() {
  printf '%s' "$keys" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const k=JSON.parse(s).find(x=>x.name===process.argv[1]);if(!k)process.exit(1);console.log(k.api_key)})' "$1"
}

echo "storage api checks"
node supabase/qa/storage-api-checks.mjs "https://${project_ref}.supabase.co" "$(key service_role)" "$(key anon)"

echo "sql checks (rolled back)"
{ echo "begin;"; cat supabase/qa/live-rls-checks.sql; echo "rollback;"; } > "$tmp_sql"
db --yes -f "$tmp_sql" -o json
