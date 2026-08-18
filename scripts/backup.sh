#!/usr/bin/env bash
# backup.sh — Create a timestamped PostgreSQL backup of the autoparts database.
# Usage: ./scripts/backup.sh
# Environment: DATABASE_URL must be set, or pass PGHOST/PGPORT/PGUSER/PGDATABASE/PASSWORD.
# Backups are stored in ./backups/ with timestamp filenames.

set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="autoparts_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[backup] Dumping database from DATABASE_URL..."
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$FILENAME"
else
  echo "[backup] DATABASE_URL not set, using individual PG* environment variables..."
  pg_dump | gzip > "$BACKUP_DIR/$FILENAME"
fi

echo "[backup] Created: $BACKUP_DIR/$FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"

# Retain last 30 backups
COUNT=$(ls -1 "$BACKUP_DIR"/autoparts_*.sql.gz 2>/dev/null | wc -l)
if [ "$COUNT" -gt 30 ]; then
  DELETE_COUNT=$((COUNT - 30))
  echo "[backup] Retaining last 30 backups, removing $DELETE_COUNT older backup(s)..."
  ls -1t "$BACKUP_DIR"/autoparts_*.sql.gz | tail -n "$DELETE_COUNT" | xargs rm -f
fi

echo "[backup] Done."
