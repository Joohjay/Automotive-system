#!/usr/bin/env bash
# backup.sh — PostgreSQL backup for ONE BennyBlax application.
#
# Usage:  ./scripts/backup.sh [app-id]
#   app-id defaults to "automotive".
#
# The application identifier selects the backup location and file prefix so
# that different applications never mix backups:
#     backups/<app-id>/<app-id>_<timestamp>.sql.gz
#
# DATABASE_URL resolution order:
#   1. $DATABASE_URL environment variable (if already set)
#   2. the app's deploy config   (deploy/apps/<app-id>.env)         [no secrets]
#   3. the app's runtime env      (APP_PATH/server/.env.production) [has DATABASE_URL]
#
# Overrides:
#   BACKUPS_ROOT   where the backups/<app-id> directory is created
#                  (default: <repo-root>/backups; on the VPS you can set
#                   BACKUPS_ROOT=/opt/bennyblax/backups)
#   RETENTION      how many backups to keep (default: 30)
#
# Example cron (per application):
#   0 2 * * * BACKUPS_ROOT=/opt/bennyblax/backups /opt/bennyblax/apps/automotive/scripts/backup.sh automotive >> /var/log/bennyblax/automotive/backup.log 2>&1

set -euo pipefail

APP_ID="${1:-automotive}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUPS_ROOT="${BACKUPS_ROOT:-$REPO_ROOT/backups}"
RETENTION="${RETENTION:-30}"

# --- Resolve the app's DATABASE_URL -------------------------------------
DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
  for f in \
    "$REPO_ROOT/deploy/apps/$APP_ID.env" \
    "/opt/bennyblax/deploy/apps/$APP_ID.env" \
    "/opt/bennyblax/apps/$APP_ID/server/.env.production" \
    "$REPO_ROOT/.env.production"; do
    if [ -f "$f" ]; then
      set -a
      # shellcheck disable=SC1090
      . "$f"
      set +a
      echo "[backup] Loaded app environment: $f"
      break
    fi
  done
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] ERROR: No DATABASE_URL found. Set DATABASE_URL or deploy apps/$APP_ID.env"
  exit 1
fi

# --- Backup --------------------------------------------------------------
BACKUP_DIR="$BACKUPS_ROOT/$APP_ID"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${APP_ID}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Dumping '$APP_ID' database..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$FILENAME"

echo "[backup] Created: $BACKUP_DIR/$FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"

# Retain the last N backups for this application only.
COUNT=$(ls -1 "$BACKUP_DIR"/"${APP_ID}"_*.sql.gz 2>/dev/null | wc -l)
if [ "$COUNT" -gt "$RETENTION" ]; then
  DELETE_COUNT=$((COUNT - RETENTION))
  echo "[backup] Retaining last $RETENTION backups, removing $DELETE_COUNT older backup(s)..."
  ls -1t "$BACKUP_DIR"/"${APP_ID}"_*.sql.gz | tail -n "$DELETE_COUNT" | xargs rm -f
fi

echo "[backup] Done ($APP_ID)."