#!/usr/bin/env bash
# monitor.sh — lightweight health/resource monitor for ONE application.
#
# Usage:  ./scripts/monitor.sh [app-id] [health-url]
#   app-id      defaults to "automotive". Reads per-app settings from the
#               app's deploy config (deploy/apps/<app-id>.env) when present.
#   health-url  optional override; default is the internal API URL derived
#               from the app's API_PORT (never exposed publicly).
#
# Checks:
#   1. API health endpoint + database status
#   2. system load / memory / disk (fails if disk > 85%)
#   3. TLS certificate expiry for the app's hostname (skipped if the
#      hostname is still a placeholder such as *.yourdomain.com)
#   4. PM2 process state (the app's process name, e.g. bennyblax-automotive-api)
#
# Exit code 1 means something failed. Suggested cron (every 5 minutes):
#   */5 * * * * /opt/bennyblax/apps/automotive/scripts/monitor.sh automotive >> /var/log/bennyblax/automotive/monitor.log 2>&1

set -uo pipefail

APP_ID="${1:-automotive}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

# --- Read per-app settings from the deploy config (no secrets) ----------
APP_HOSTNAME=""
API_PORT=""
APP_NAME=""
for f in "$REPO_ROOT/deploy/apps/$APP_ID.env" "/opt/bennyblax/deploy/apps/$APP_ID.env"; do
  if [ -f "$f" ]; then
    while IFS='=' read -r key value; do
      case "$key" in
        APP_HOSTNAME) APP_HOSTNAME="$value" ;;
        API_PORT)     API_PORT="$value" ;;
        APP_NAME)     APP_NAME="$value" ;;
      esac
    done < <(grep -E '^(APP_HOSTNAME|API_PORT|APP_NAME)=' "$f" 2>/dev/null)
    break
  fi
done

API_URL="${2:-http://127.0.0.1:${API_PORT:-4000}/api/health}"
APP_HOSTNAME="${APP_HOSTNAME:-auto.yourdomain.com}"
PM2_NAME="${APP_NAME:-${APP_ID}-api}"
CERT_PATH="${CERT_PATH:-/etc/letsencrypt/live/$APP_HOSTNAME/fullchain.pem}"

echo "=== Monitor [$APP_ID] $(date -Is) ==="

# 1. API health
if HTTP_RESPONSE="$(curl -fsS --max-time 10 "$API_URL" 2>&1)"; then
  echo "[ok] $APP_ID API health: $HTTP_RESPONSE"
else
  echo "[FAIL] $APP_ID API health endpoint unreachable: $HTTP_RESPONSE"
  FAILED=1
fi

# 2. System resources
echo "[sys] Load:  $(cut -d' ' -f1-3 /proc/loadavg)"
echo "[sys] Mem:   $(free -h | awk 'NR==2{printf "%s used / %s total", $3, $2}')"
echo "[sys] Disk:  $(df -h / | awk 'NR==2{printf "%s used / %s avail (%s)", $3, $4, $5}')"
if df -h / | awk 'NR==2{ sub(/%/,"",$5); if ($5 > 85) exit 0; exit 1 }'; then
  echo "[FAIL] Disk usage above 85%"
  FAILED=1
fi

# 3. TLS certificate expiry (only when a real hostname is configured)
if [[ "$APP_HOSTNAME" == *yourdomain.com* ]] || [[ "$APP_HOSTNAME" == *.example.com* ]]; then
  echo "[warn] Hostname '$APP_HOSTNAME' looks like a placeholder — skipping TLS check"
elif [ -f "$CERT_PATH" ]; then
  EXPIRY="$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)"
  DAYS="$(( ( $(date -d "$EXPIRY" +%s) - $(date +%s) ) / 86400 ))"
  echo "[tls] Certificate '$CERT_PATH' expires $EXPIRY (${DAYS} days)"
  if [ "$DAYS" -lt 7 ]; then
    echo "[FAIL] Certificate expires in under 7 days"
    FAILED=1
  fi
else
  echo "[FAIL] No certificate found at $CERT_PATH"
  FAILED=1
fi

# 4. PM2 process state
if command -v pm2 >/dev/null 2>&1; then
  if pm2 jlist 2>/dev/null | grep -q "\"name\":\"$PM2_NAME\"" && \
     pm2 jlist 2>/dev/null | grep -q "\"name\":\"$PM2_NAME\".*\"status\":\"online\""; then
    echo "[ok] PM2 $PM2_NAME is online"
  else
    echo "[FAIL] PM2 $PM2_NAME is not online"
    FAILED=1
  fi
else
  echo "[warn] pm2 not installed (skipping process check)"
fi

echo "=== Monitor done [$APP_ID] $(date -Is) ==="
exit "$FAILED"