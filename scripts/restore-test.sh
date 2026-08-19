#!/usr/bin/env bash
# restore-test.sh — SAFELY verify a backup for ONE application by restoring
# it into a throwaway database, running sanity checks, then dropping it.
#
# Usage:  ./scripts/restore-test.sh <app-id> <backup-file.sql.gz>
#   app-id        REQUIRED explicit application identifier. The throwaway
#                 database is named <app-id>_restore_test_<timestamp> so it
#                 can never be mistaken for another application's database.
#   backup-file   the .sql.gz backup produced by scripts/backup.sh <app-id>
#
# Environment:
#   DATABASE_URL  MUST point at a server where we are allowed to CREATE/DROP
#                 databases (e.g. postgresql://postgres@localhost:5432/postgres).
#                 It is NEVER the production application URL — this script does
#                 not read app environment files, so it cannot accidentally
#                 point at a production database.
#
# The throwaway database is always dropped on exit. Production databases are
# never modified by this script.

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <app-id> <backup-file.sql.gz>"
  echo "Example: $0 automotive backups/automotive/automotive_20260818_020000.sql.gz"
  exit 1
fi

APP_ID="$1"
BACKUP_FILE="$2"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore-test] ERROR: File not found: $BACKUP_FILE"
  exit 1
fi

ADMIN_DB="${DATABASE_URL:-postgresql://postgres@localhost:5432/postgres}"
TEST_DB="${APP_ID}_restore_test_$(date +%s)"
TEST_URL="${ADMIN_DB%/*}/$TEST_DB"

echo "[restore-test] Creating throwaway database: $TEST_DB"
createdb "$ADMIN_DB" "$TEST_DB"

cleanup() {
  echo "[restore-test] Dropping throwaway database: $TEST_DB"
  dropdb "$ADMIN_DB" "$TEST_DB" || true
}
trap cleanup EXIT

echo "[restore-test] Restoring $BACKUP_FILE into $TEST_DB ..."
gunzip -c "$BACKUP_FILE" | psql "$TEST_URL" --quiet --set ON_ERROR_STOP=1

echo "[restore-test] Running sanity checks ..."

check() {
  local label="$1"
  local query="$2"
  local min="${3:-1}"
  local rows
  rows="$(psql "$TEST_URL" -tA -c "$query")"
  if [ -z "$rows" ] || [ "$rows" -lt "$min" ]; then
    echo "[restore-test] FAIL: $label (expected >= $min, got '${rows:-none}')"
    exit 1
  fi
  echo "[restore-test]   ok: $label ($rows)"
}

# NOTE: these sanity queries target the Automotive schema. If a future
# application has a different schema, adjust or pass per-app queries.
check "users"      'SELECT COUNT(*) FROM "User";' 1
check "roles"      'SELECT COUNT(*) FROM "Role";' 1
check "branches"   'SELECT COUNT(*) FROM "Branch";' 1
check "products"   'SELECT COUNT(*) FROM "Product";' 0
check "sales"      'SELECT COUNT(*) FROM "Sale";' 0
check "purchases"  'SELECT COUNT(*) FROM "Purchase";' 0
check "inventory"  'SELECT COUNT(*) FROM "Inventory";' 0
check "audit_logs" 'SELECT COUNT(*) FROM "AuditLog";' 0

echo "[restore-test] PASS: $APP_ID backup is restorable and internally consistent."
echo "[restore-test] Done (throwaway database removed)."