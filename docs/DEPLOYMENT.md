# Deployment Guide

BennyBlax Enterprises — Automotive Spare Parts Management System

> This VPS is designed to host MULTIPLE independent BennyBlax applications
> (Automotive now, Motorcycle later). The full multi-application architecture,
> including the Motorcycle example, is in **[MULTIAPP.md](MULTIAPP.md)**.
> This guide documents the Automotive runbook; where single-app paths appear,
> the multi-app equivalents are referenced.

---

## 1. Server Specifications

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 LTS |
| Node.js | 20.19+ | 22 LTS |
| PostgreSQL | 14+ | 16+ |

---

## 2. Required Software

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y curl git build-essential postgresql postgresql-client

# Install Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# Verify
node --version   # v22.x+
pg_config --version  # PostgreSQL 14+
```

---

## 3. Environment Variables

### Backend (server/.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | API port (default: 4100) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Random secret, 32+ chars. Generate: `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | No | Token lifetime (default: `8h`) |
| `CLIENT_ORIGIN` | Yes | Frontend URL, e.g. `https://auto.bennyblax.co.tz` |

### Frontend (client/.env.production — set at build time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Leave EMPTY for the recommended same-origin setup (the app calls `/api` on the same hostname). Set only for the split-subdomain option (§18), e.g. `https://api.bennyblax.co.tz/api` |

---

## 4. Production Setup

### 4.1 Create Production Database

The database is created automatically by `deploy/setup-app.sh automotive`.
Manual equivalent (dedicated user + database per application):

```bash
sudo -u postgres psql
```

```sql
CREATE USER bennyblax_automotive WITH PASSWORD 'your-strong-password-here';
CREATE DATABASE bennyblax_automotive OWNER bennyblax_automotive;
GRANT ALL PRIVILEGES ON DATABASE bennyblax_automotive TO bennyblax_automotive;
\q
```

### 4.2 Clone and Configure

```bash
cd /opt/bennyblax/apps
git clone https://github.com/Joohjay/Automotive-system.git automotive

# Backend environment
cp automotive/server/.env.example automotive/server/.env
# Edit automotive/server/.env with production values:
#   NODE_ENV=production
#   DATABASE_URL=postgresql://bennyblax_automotive:your-strong-password@localhost:5432/bennyblax_automotive
#   JWT_SECRET=<generate with: openssl rand -hex 64>
#   CLIENT_ORIGIN=https://auto.bennyblax.co.tz
```

### 4.3 Install Dependencies and Build

```bash
# Backend
cd server
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run build

# Frontend (same-origin: leave VITE_API_URL empty so the app calls /api)
cd ../client
npm ci
npm run build
```

### 4.4 Start Production Server

```bash
cd /opt/bennyblax/apps/automotive/server
NODE_ENV=production node dist/index.js
```

---

## 5. Process Management (PM2)

PM2 manages ONE independent process per application. The repository provides
`deploy/ecosystem.config.cjs`, which reads every `deploy/apps/<app>.env` and
registers a uniquely-named process per app (e.g. `bennyblax-automotive-api`).
See [MULTIAPP.md](MULTIAPP.md) §5 for the multi-app design.

```bash
npm install -g pm2

cd /opt/bennyblax/apps/automotive   # or /opt/bennyblax/deploy
pm2 start deploy/ecosystem.config.cjs

pm2 save
pm2 startup  # Follow the printed command to enable auto-restart on reboot
```

### PM2 Commands

```bash
pm2 list                  # List all processes
pm2 logs bennyblax-automotive-api  # View logs
pm2 restart bennyblax-automotive-api # Restart one app only (others unaffected)
pm2 stop bennyblax-automotive-api   # Stop one app only
pm2 delete bennyblax-automotive-api # Remove one app only
pm2 monit                 # Real-time monitoring
```

---

## 6. Reverse Proxy (Nginx)

```bash
sudo apt install -y nginx
```

Nginx is the ONLY public entry point. Each application gets its own
virtual-host configuration rendered from `deploy/templates/nginx-site.conf`
(the recommended setup serves frontend AND `/api` from one hostname — no CORS;
see [MULTIAPP.md](MULTIAPP.md) §3 and §18 for the split-subdomain option).

### Generate and install the Automotive virtual host

```bash
# Render-only preview (safe, no system changes):
cd /opt/bennyblax/deploy
./setup-app.sh automotive --render-only
# inspect: deploy/rendered/automotive.conf

# Full install (renders -> /etc/nginx/sites-available/automotive.conf,
# symlinks into sites-enabled/, runs nginx -t, reloads):
./setup-app.sh automotive
```

The rendered config includes: HTTP→HTTPS redirect, TLS, security headers,
gzip, SPA routing, static-asset caching, and `location /api/ { proxy_pass
http://127.0.0.1:<API_PORT>; }` with the standard proxy headers. Internal
ports are never exposed publicly.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx

# Frontend hostname (single-hostname setup)
sudo certbot certonly --nginx -d auto.bennyblax.co.tz

# Auto-renewal (certbot installs a cron job automatically)
sudo certbot renew --dry-run
```

---

## 8. DNS Configuration

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | app | YOUR_SERVER_IP | 300 |
| A | api | YOUR_SERVER_IP | 300 |

---

## 9. Database Backup

The backup script is application-aware (`./scripts/backup.sh <app-id>`,
defaults to `automotive`). It writes app-scoped files to
`backups/<app-id>/<app-id>_<timestamp>.sql.gz` and retains the last 30 backups
**per application**. It reads `DATABASE_URL` from the app's env file or from
the environment. See [MULTIAPP.md](MULTIAPP.md) §9.

### Automated Daily Backup (cron)

```bash
# Edit crontab
crontab -e

# Add: daily backup at 2 AM (Automotive app)
0 2 * * * BACKUPS_ROOT=/opt/bennyblax/backups /opt/bennyblax/apps/automotive/scripts/backup.sh automotive >> /var/log/bennyblax/automotive/backup.log 2>&1
```

### Manual Backup

```bash
./scripts/backup.sh automotive
# or with explicit connection:
DATABASE_URL="postgresql://bennyblax_automotive:password@localhost:5432/bennyblax_automotive" \
  ./scripts/backup.sh automotive
```

### Restore

```bash
# ALWAYS test on a separate database first! The test script restores into a
# throwaway database, runs sanity checks, then drops it. It never touches
# the production database, and it requires an EXPLICIT app identifier so a
# backup can never land in another application's database.
DATABASE_URL="postgresql://postgres@localhost:5432/postgres" \
  ./scripts/restore-test.sh automotive backups/automotive/automotive_20260818_020000.sql.gz

# Production restore (DANGEROUS — overwrites data)
DATABASE_URL="postgresql://bennyblax_automotive:password@localhost:5432/bennyblax_automotive" \
  ./scripts/restore.sh backups/automotive/automotive_20260818_020000.sql.gz
```

### Off-site Backup

Copy backups to external storage regularly:

```bash
# Example: copy to S3-compatible storage
aws s3 sync ./backups/ s3://your-backup-bucket/bennyblax/ --storage-class STANDARD_IA

# Or rsync to a remote server
rsync -avz ./backups/ backup-user@remote-server:/backups/bennyblax/
```

---

## 10. Database Migration Procedure

```bash
cd /opt/bennyblax/apps/automotive/server

# Run pending migrations
npx prisma migrate deploy

# Generate Prisma client (if schema changed)
npx prisma generate

# Restart the server
pm2 restart bennyblax-automotive-api
```

**Important:** Never run `prisma migrate dev` or `prisma migrate reset` in production.

---

## 11. Updating the Application

```bash
cd /opt/bennyblax/apps/automotive

# Pull latest code
git pull origin main

# Backend
cd server
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart bennyblax-automotive-api

# Frontend (same-origin: leave VITE_API_URL empty so the app calls /api)
cd ../client
npm ci
npm run build
# Nginx serves the new dist/ automatically

# Verify
curl -s https://auto.bennyblax.co.tz/api/health
```

---

## 12. Log Management

Application logs live per app in `/var/log/bennyblax/<app>/` (PM2 + Nginx).
To prevent disk exhaustion:

```bash
# Install logrotate
sudo apt install -y logrotate

# Create /etc/logrotate.d/bennyblax (per-application log dirs)
/var/log/bennyblax/*/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

For production, consider using PM2 log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

---

## 13. Health Check

```bash
# Application + database status
curl -s https://auto.bennyblax.co.tz/api/health | jq

# Expected response:
# {
#   "status": "ok",
#   "service": "autoparts-api",
#   "database": "up",
#   "timestamp": "2026-08-18T...",
#   "uptime": 12345.678
# }
```

---

## 13.5 Monitoring

A lightweight, application-aware health/resource monitor is included:

```bash
# Monitor the Automotive app (defaults to its internal API on port 4100)
./scripts/monitor.sh automotive

# Monitor any other app (future) — no rewrite needed
./scripts/monitor.sh motorcycle

# Optional health URL override
./scripts/monitor.sh automotive https://auto.bennyblax.co.tz/api/health
```

It checks: API health + database status, system load/memory/disk (fails if disk
> 85%), TLS certificate expiry (fails if < 7 days; skipped while the hostname
is a placeholder), and the app's PM2 process state.
Exit code `1` means something failed.

Recommended cron (every 5 minutes, per application):

```bash
*/5 * * * * /opt/bennyblax/apps/automotive/scripts/monitor.sh automotive >> /var/log/bennyblax/automotive/monitor.log 2>&1
```

Pair this with a basic host-level alert (e.g. `fail2ban` on SSH, `monit`, or
your provider's uptime check against `https://auto.bennyblax.co.tz/api/health`).

---

## 13.6 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw --force enable
sudo ufw status
```

Only ports 22, 80, 443 should be open. The API (port 4100) must NOT be exposed
publicly — Nginx proxies to it over localhost. If you need remote DB access,
use an SSH tunnel instead of opening 5432.

---

## 14. First-Time Production Setup

After deploying to a fresh production database, create the OWNER admin with
the dedicated provisioning script. **Never run the dev seed
(`prisma/seed.ts`) in production** — it refuses to run with `NODE_ENV=production`,
and forcing it with `NODE_ENV=development` would create the development admin
with the well-known development password (`Admin@12345`).

```bash
cd /opt/bennyblax/apps/automotive/server

# With your own strong password (12+ chars, NOT the dev password):
ADMIN_EMAIL=owner@yourdomain.com \
ADMIN_FULL_NAME="Benny Blax" \
ADMIN_PASSWORD="a-strong-unique-password-here" \
npx tsx scripts/provision-admin.ts

# OR let it generate a strong random password (printed exactly once):
ADMIN_EMAIL=owner@yourdomain.com npx tsx scripts/provision-admin.ts
```

The script upserts the account with the `OWNER` role, assigns the first active
branch, resets any lockout state, and never writes secrets to disk.

---

## 15. Emergency Rollback

Decide rollback BEFORE deploying, and write down the previous good commit hash.

### 15.1 Code rollback

```bash
cd /opt/bennyblax/apps/automotive
git log --oneline -10          # find the last good commit
git checkout <good-commit-hash>
cd server && npm ci --omit=dev && npx prisma generate && npm run build
pm2 restart bennyblax-automotive-api
cd ../client && npm ci && npm run build
# Nginx serves the previous dist/ immediately (or keep a copy of dist/ before deploying)
```

### 15.2 Database rollback

```bash
# Check migration state
cd /opt/bennyblax/apps/automotive/server && npx prisma migrate status

# If a migration caused corruption/errors, restore the last GOOD backup:
DATABASE_URL="postgresql://bennyblax_automotive:password@localhost:5432/bennyblax_automotive" \
  /opt/bennyblax/apps/automotive/scripts/restore.sh backups/automotive/automotive_<last-good>.sql.gz
```

Rollback order: stop accepting new traffic (disable the `/api/` location or
point DNS away), restore code, restore DB only if needed, then re-enable and
verify with `/api/health` and a test login.

---

## 16. Architecture Overview

```
Internet
   ↓
DNS (A record for auto.bennyblax.co.tz → server IP)
   ↓
HTTPS (Let's Encrypt / Certbot, hostname-based)
   ↓
Nginx (reverse proxy — ONLY public entry point)
   ├── auto.bennyblax.co.tz → /opt/bennyblax/apps/automotive/client/dist (static SPA)
   └── /api/                → proxy_pass http://127.0.0.1:4100
                               ↓
                         Node.js (PM2, bennyblax-automotive-api)
                         Express 5 + Prisma
                               ↓
                         PostgreSQL (bennyblax_automotive)
```

Future applications (e.g. Motorcycle) add their own hostname, Nginx vhost,
PM2 process, port, database and certificate — see [MULTIAPP.md](MULTIAPP.md).

---

## 17. Quick Reference Commands

```bash
# Start everything (registers one PM2 process per app in deploy/apps/*.env)
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # follow printed command

# Check API health
curl -s http://localhost:4100/api/health

# View logs
pm2 logs bennyblax-automotive-api

# Database shell
psql -U bennyblax_automotive -d bennyblax_automotive

# Run migrations
cd server && npx prisma migrate deploy

# Rebuild frontend (same-origin option: VITE_API_URL left empty)
cd client && npm run build

# Provision the production admin
cd server && ADMIN_EMAIL=owner@yourdomain.com npx tsx scripts/provision-admin.ts

# Backup one app
./scripts/backup.sh automotive

# Test a backup restore (safe, throwaway DB)
DATABASE_URL="postgresql://postgres@localhost:5432/postgres" ./scripts/restore-test.sh automotive backups/automotive/<file>.sql.gz

# Restore (DANGEROUS)
DATABASE_URL="..." ./scripts/restore.sh backups/automotive/<file>.sql.gz

# Monitor one app
./scripts/monitor.sh automotive
```

---

## 18. Alternative Architecture: Two Subdomains

The simplest supported setup (recommended in Section 6) serves frontend and
API from one hostname. The split setup (`app.` + `api.`) is also supported:

- `CLIENT_ORIGIN=https://app.bennyblax.co.tz` (server .env)
- `VITE_API_URL=https://api.bennyblax.co.tz/api` (client, set at build time)
- Both A records → server IP; two Nginx server blocks; two certs.
- Note: `sameSite=lax` cookies work across `app.`/`api.` because they are the
  same registrable domain (same-site, cross-origin).

Prefer the single-hostname option unless you have a reason to split.

---

## 19. Deployment Readiness Report

Fill in the table below during/after the first production deployment.

| Item | Status | Notes |
|------|--------|-------|
| Domain purchased & DNS A record points at server | ☐ | |
| VPS provisioned (specs per Section 1) | ☐ | |
| Ubuntu + Node 22 + PostgreSQL installed | ☐ | |
| Production DB created (bennyblax_automotive) | ☐ | |
| server/.env set (production-validated on boot) | ☐ | |
| `prisma migrate deploy` applied | ☐ | |
| `npm run build` (server) succeeded | ☐ | |
| Admin provisioned via `scripts/provision-admin.ts` | ☐ | |
| SMTP verified (reset email sends) | ☐ | |
| client build done (VITE_API_URL per Section 6/18) | ☐ | |
| Nginx config live, `nginx -t` clean, HTTPS valid | ☐ | |
| ufw firewall active (22, 80, 443 only) | ☐ | |
| PM2 running, `pm2 save`, `pm2 startup` set | ☐ | |
| Backup cron + restore-test passed | ☐ | |
| Monitor cron running, health endpoint public | ☐ | |
| rollback commit hash recorded | ☐ | |
