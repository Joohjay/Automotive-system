#!/usr/bin/env bash
# restore.sh — Restore a PostgreSQL backup into the autoparts database.
# Usage: ./scripts/restore.sh <backup-file.sql.gz>
# WARNING: This will DROP and recreate all tables in the target database.
# Always test restores on a separate database first.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo "Example: $0 backups/autoparts_20260818_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore] ERROR: File not found: $BACKUP_FILE"
  exit 1
fi

echo "[restore] WARNING: This will overwrite the target database."
echo "[restore] File: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
echo "[restore] Press Ctrl+C within 5 seconds to abort..."
sleep 5

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[restore] Restoring from DATABASE_URL..."
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --quiet
else
  echo "[restore] DATABASE_URL not set, using individual PG* environment variables..."
  gunzip -c "$BACKUP_FILE" | psql --quiet
fi

echo "[restore] Done. Verify with: SELECT COUNT(*) FROM \"Product\";"
