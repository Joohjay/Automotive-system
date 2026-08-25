# Multi-Application VPS Deployment Architecture

BennyBlax Enterprises — one VPS, many independent applications.

This document describes how the VPS can host several completely independent
applications (Automotive now; Motorcycle and other business systems later)
without any of them sharing secrets, databases, processes, ports, hostnames,
logs, backups or configuration.

**Current application:** Automotive Spare Parts Management System
(`APP_ID=automotive`, hostname `auto.bennyblax.co.tz`, port `4100`).

> Motorcycle is used ONLY as an architectural example below. No Motorcycle
> code or configuration is implemented in this repository.

---

## 1. One VPS, many applications

```
ONE VPS
  |
  +-- deploy/            shared provisioning tooling + per-app configs
  |
  +-- apps/
  |     automotive/      source + build        (APP_ID=automotive)
  |     motorcycle/      future source/build   (APP_ID=motorcycle)
  |
  +-- backups/
  |     automotive/      backups/<app>/...
  |     motorcycle/      (future)
  |
  +-- logs/              app logs in /var/log/bennyblax/<app>/
  |
  +-- PostgreSQL
        bennyblax_automotive   (dedicated user bennyblax_automotive)
        bennyblax_motorcycle   (future, dedicated user)
  |
  +-- Nginx (public HTTPS entry point only)
  +-- PM2  (one independent process per app)
```

Rule of thumb: **every application owns everything it needs** — source,
environment, process, database, credentials, logs, backups, hostname, TLS,
Nginx virtual host. Nothing is shared except the OS and the reverse proxy.

---

## 2. Application identity (no hardcoded hostnames)

Deployment tooling never assumes there is only one application. Each app has
a NON-SECRET infrastructure config file:

`deploy/apps/automotive.env`

```
APP_ID=automotive
APP_NAME=bennyblax-automotive-api
APP_HOSTNAME=auto.bennyblax.co.tz
APP_PATH=/opt/bennyblax/apps/automotive
API_PORT=4100
DB_NAME=bennyblax_automotive
DB_USER=bennyblax_automotive
```

A future app adds its own file (`deploy/apps/motorcycle.env`) with its own
values (`moto.bennyblax.co.tz`, port `4001`, `bennyblax_motorcycle`, …).
The committed template is `deploy/apps/automotive.env.example`; real files are
created on the server by `deploy/setup-app.sh` and are gitignored.

---

## 3. Nginx architecture

Configurations live in the standard Debian layout and are generated per app:

```
/etc/nginx/
  sites-available/automotive.conf      (rendered from deploy/templates/nginx-site.conf)
  sites-available/motorcycle.conf      (future — added WITHOUT touching automotive.conf)
  sites-enabled/automotive.conf -> sites-available/automotive.conf
  snippets/                            (optional shared snippets)
```

- `deploy/templates/nginx-site.conf` is a parameterized virtual host. It is
  rendered with `envsubst` (only the app placeholders are substituted; Nginx
  runtime variables like `$host` are untouched).
- Routing is **hostname-based**: `auto.bennyblax.co.tz` → Automotive frontend
  + `/api`; `moto.bennyblax.co.tz` → Motorcycle (future).
- Each app has its own `server_name`, TLS cert paths, log files and proxy port.
- Adding an application never modifies another app's config file.
- Install: `deploy/setup-app.sh <app-id>` renders the file, symlinks it into
  `sites-enabled/`, runs `nginx -t` and reloads.

---

## 4. Application directory structure

```
/opt/bennyblax/
  apps/
    automotive/          source + server/dist + client/dist
    motorcycle/          (future)
  backups/
    automotive/
    motorcycle/          (future)
  deploy/                copy of this repository's deploy/ (templates,
                         ecosystem.config.cjs, setup-app.sh, apps/*.env)
```

Logs are separate from code:

```
/var/log/bennyblax/
  automotive/
    out.log err.log         PM2 stdout/stderr
    nginx-access.log        Nginx access (per virtual host)
    nginx-error.log
    backup.log monitor.log  cron output
  motorcycle/               (future)
```

Each application is confined to its own directories; deploying or removing one
never touches another's files.

---

## 5. Process management (PM2)

One PM2 daemon manages **one independent process per application**. The
ecosystem file reads every `deploy/apps/*.env` and registers a process with a
unique, application-specific name:

```
bennyblax-automotive-api
bennyblax-motorcycle-api     (future)
```

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed command
```

Processes are fully isolated by PM2: restarting, crashing or redeploying one
application never stops another.

---

## 6. Port management

Public traffic enters ONLY through Nginx on 443/80. Each application listens
on its own private loopback port:

| App        | Port | Notes                        |
|------------|------|------------------------------|
| Automotive | 4100 | proxied by Nginx `/api/`     |
| Motorcycle | 4101 | future                       |
| …          | 4102 | future                       |

Ports are configurable via `API_PORT` in each app's config. **Never expose
internal ports (4100+) or PostgreSQL (5432) to the public internet.**

---

## 7. Database isolation

Each application gets its own PostgreSQL database **and** a dedicated user
that can only access that database:

```sql
-- Automotive (created by deploy/setup-app.sh)
CREATE ROLE bennyblax_automotive LOGIN PASSWORD '<generated>';
CREATE DATABASE bennyblax_automotive OWNER bennyblax_automotive;

-- Motorcycle (future — separate database, separate user)
CREATE ROLE bennyblax_motorcycle LOGIN PASSWORD '<generated>';
CREATE DATABASE bennyblax_motorcycle OWNER bennyblax_motorcycle;
```

- `deploy/setup-app.sh` generates a strong random password, creates the
  role/database, and writes the `DATABASE_URL` into that app's
  `.env.production` (never committed, never printed).
- The Automotive Prisma schema is unchanged; migrations run per database with
  `prisma migrate deploy` inside each app's server directory.
- One app's database outage never affects another app (separate connections,
  separate processes).

---

## 8. Environment isolation

There is NO single global `.env` for every app. Each app owns its secrets:

```
/opt/bennyblax/apps/automotive/server/.env.production
/opt/bennyblax/apps/motorcycle/server/.env.production   (future)
```

Generated by `deploy/setup-app.sh` with per-app values:

```
NODE_ENV=production
PORT=4100
CLIENT_ORIGIN=https://auto.bennyblax.co.tz
DATABASE_URL=postgresql://bennyblax_automotive:<generated>@127.0.0.1:5432/bennyblax_automotive
JWT_SECRET=<openssl rand -hex 64>
EMAIL_PROVIDER=smtp          # fill in SMTP_* per app
```

Each app has its own `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, SMTP
settings, port and hostname. **Never reuse another app's JWT secret or
database credentials.** Real secrets are never committed (`.gitignore`
excludes `.env*` and `deploy/apps/*.env`).

---

## 9. Backup architecture

`scripts/backup.sh` takes an application identifier and writes into that app's
own backup directory with that app's file prefix:

```bash
./scripts/backup.sh automotive        # -> backups/automotive/automotive_20260819_020000.sql.gz
./scripts/backup.sh motorcycle        # future -> backups/motorcycle/motorcycle_*.sql.gz
```

- `DATABASE_URL` is read from the app's env (config or runtime env), so each
  app backs up only its own database.
- Retention is enforced **per application** (default 30 backups each).
- On the VPS, point `BACKUPS_ROOT=/opt/bennyblax/backups` so backups land in
  the shared-but-app-scoped area. Cron per app:

```
0 2 * * * BACKUPS_ROOT=/opt/bennyblax/backups /opt/bennyblax/apps/automotive/scripts/backup.sh automotive >> /var/log/bennyblax/automotive/backup.log 2>&1
```

---

## 10. Restore testing (safety)

`scripts/restore-test.sh` requires an **explicit application identifier** and
uses a throwaway database named after it — it can never restore an Automotive
backup over another app's production database:

```bash
DATABASE_URL="postgresql://postgres@localhost:5432/postgres" \
  ./scripts/restore-test.sh automotive backups/automotive/automotive_20260819_020000.sql.gz
```

- The admin `DATABASE_URL` must point at a server where CREATE/DROP DATABASE
  is allowed (e.g. the `postgres` superuser, the `postgres` maintenance DB).
  The script never reads an application's runtime env, so it cannot
  accidentally target a production database.
- It creates `<app>_restore_test_<timestamp>`, restores, runs sanity checks,
  then always drops the throwaway database (even on failure).
- Production databases are never modified by a restore test.

---

## 11. Monitoring

`scripts/monitor.sh` is application-aware: it accepts an app identifier,
reads that app's hostname/port/PM2 name, and checks:

1. API health + database status (internal URL, e.g. `http://127.0.0.1:4100/api/health`)
2. system load / memory / disk (>85% = fail)
3. TLS certificate expiry for that app's hostname (skipped while the hostname
   is a placeholder such as `*.yourdomain.com`)
4. PM2 process state for that app's process name

```bash
./scripts/monitor.sh automotive
./scripts/monitor.sh motorcycle        # future — no rewrite needed
```

Multiple apps → multiple scheduled checks, each tagged by app in the log:

```
*/5 * * * * /opt/bennyblax/apps/automotive/scripts/monitor.sh automotive >> /var/log/bennyblax/automotive/monitor.log 2>&1
*/5 * * * * /opt/bennyblax/apps/motorcycle/scripts/monitor.sh motorcycle >> /var/log/bennyblax/motorcycle/monitor.log 2>&1
```

---

## 12. Logging

Logs are distinguishable by application:

- **Application (PM2):** `/var/log/bennyblax/<app>/out.log`, `err.log`
  (set per app in `deploy/ecosystem.config.cjs`).
- **Nginx:** `/var/log/bennyblax/<app>/nginx-access.log`, `nginx-error.log`
  (per virtual host — set in the rendered site config).
- **Cron:** `<app>/backup.log`, `<app>/monitor.log`.

A future app's logs go into its own directory; there is no ambiguous
application-wide log.

---

## 13. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'     # 80 + 443
sudo ufw --force enable
sudo ufw status
```

Publicly exposed:
- `443/tcp` (HTTPS) — required.
- `80/tcp` (HTTP) — only for HTTPS redirect + Let's Encrypt issuance.

**Never exposed publicly:** internal application ports (`4100`, `4101`, …) and
PostgreSQL (`5432`). Applications communicate internally over loopback; Nginx
is the only public entry point. Use an SSH tunnel instead of opening 5432 if
remote DB access is ever needed.

---

## 14. SSL/TLS

TLS is **hostname-based** and per application. Each app's Nginx virtual host
references its own certificate:

```
/etc/letsencrypt/live/auto.bennyblax.co.tz/fullchain.pem   (Automotive)
/etc/letsencrypt/live/moto.bennyblax.co.tz/fullchain.pem   (Motorcycle, future)
```

Issue/install the Automotive certificate (webroot or nginx plugin):

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d auto.bennyblax.co.tz
# Certbot auto-renews; verify with:
sudo certbot renew --dry-run
```

Adding a new hostname = add the app (which renders its own vhost) + run
certbot for that hostname. Nothing is hardcoded in shared infrastructure.

---

## 15. Deploying the Automotive application (runbook)

Run these on the VPS (Ubuntu/Debian, Node 22, PostgreSQL installed):

```bash
# 1. Provision directories, Nginx vhost, DB + user, secrets
cd /opt/bennyblax/deploy
./setup-app.sh automotive

# 2. Copy the source into its app directory
rsync -a --exclude .git --exclude node_modules --exclude dist \
  /path/to/Automotive-system/ /opt/bennyblax/apps/automotive/

# 3. Build the backend + run migrations
cd /opt/bennyblax/apps/automotive/server
npm ci --omit=dev
npx prisma generate && npx prisma migrate deploy
npm run build

# 4. Build the frontend (same-origin: leave VITE_API_URL empty)
cd ../client && npm ci && npm run build

# 5. Create the OWNER admin (strong password / generated)
cd ../server
ADMIN_EMAIL=owner@yourdomain.com npx tsx scripts/provision-admin.ts

# 6. Start under PM2 (registers automotive + any future apps)
cd /opt/bennyblax/deploy
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup

# 7. TLS
sudo certbot certonly --webroot -w /var/www/certbot -d auto.bennyblax.co.tz
sudo nginx -t && sudo systemctl reload nginx

# 8. Verify
curl -s https://auto.bennyblax.co.tz/api/health
./scripts/monitor.sh automotive
```

---

## 16. Adding a second independent application (Motorcycle — example only)

```bash
# 1. Register the app (new config, dirs, Nginx vhost, DB+user, secrets)
cd /opt/bennyblax/deploy
./setup-app.sh motorcycle \
  --hostname moto.bennyblax.co.tz \
  --port 4001 \
  --db-name bennyblax_motorcycle \
  --db-user bennyblax_motorcycle

# 2. Deploy that app's own source to /opt/bennyblax/apps/motorcycle, build,
#    migrate, and provision its admin (steps 2–5 of section 15, in its dir).

# 3. Reload PM2 (registers the new process; automotive is untouched)
pm2 reload ecosystem.config.cjs

# 4. Issue its own certificate
sudo certbot certonly --webroot -w /var/www/certbot -d moto.bennyblax.co.tz
sudo nginx -t && sudo systemctl reload nginx
```

`pm2 start/restart bennyblax-motorcycle-api` never affects
`bennyblax-automotive-api`; redeploying Motorcycle never modifies Automotive
files/database/configuration.

---

## 17. Removing one application without affecting others

```bash
APP=motorcycle   # example

# Stop + remove its PM2 process (others keep running)
pm2 delete "bennyblax-${APP}-api"
pm2 save

# Remove its Nginx virtual host and reload
sudo rm /etc/nginx/sites-enabled/${APP}.conf /etc/nginx/sites-available/${APP}.conf
sudo nginx -t && sudo systemctl reload nginx

# Drop its certificate (optional)
sudo certbot delete --cert-name ${APP}.bennyblax.co.tz

# Drop its database and user (destructive — confirm first)
sudo -u postgres psql -c "DROP DATABASE bennyblax_${APP};"
sudo -u postgres psql -c "DROP ROLE bennyblax_${APP};"

# Remove its directories
sudo rm -rf /opt/bennyblax/apps/${APP} /opt/bennyblax/backups/${APP} /var/log/bennyblax/${APP}
sudo rm deploy/apps/${APP}.env
```

Nothing in this list touches another application's files, process, database
or configuration. Automotive keeps running throughout.

---

## 18. Security requirements (maintained)

All existing protections are preserved and each application keeps its own:

- `httpOnly` + `Secure` (production) + `SameSite=lax` auth cookie
- CSRF protection, timing-safe login, RBAC, branch isolation
- password-reset security (real SMTP per app; console provider forbidden in
  production by the startup guard)
- rate limiting and audit logging
- production environment validation at boot
- **own `JWT_SECRET`** — never reuse another app's
- **own database credentials** — never reuse another app's

The one shared surface is Nginx (TLS + proxy). The API processes listen only
on loopback; PostgreSQL listens only on loopback; the firewall exposes only
80/443.

---

## 19. What is NOT used here

No Kubernetes, Docker Swarm, microservices, service mesh, orchestration or
multi-server clustering. This is a single VPS with Nginx + PM2 + PostgreSQL
and per-application isolation — simple, maintainable, production-ready for
the current business scale.

---

## 20. Architecture summary (commands)

```bash
# Render Automotive vhost locally (safe, no changes)
./deploy/setup-app.sh automotive --render-only

# PM2: see exactly which processes would be registered
node -e "console.log(JSON.stringify(require('./deploy/ecosystem.config.cjs'),null,2))"

# Backup one app
./scripts/backup.sh automotive

# Test a backup restore (throwaway DB, never production)
DATABASE_URL="postgresql://postgres@localhost:5432/postgres" ./scripts/restore-test.sh automotive backups/automotive/<file>.sql.gz

# Monitor one app
./scripts/monitor.sh automotive
```