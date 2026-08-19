# deploy/ — multi-application VPS deployment tooling

This directory makes the BennyBlax deployment reusable for multiple
independent applications on ONE VPS (Automotive now, Motorcycle and others
later). Each application gets its own source directory, database, user,
environment secrets, PM2 process, Nginx virtual host, logs and backups.

## Layout

```
deploy/
  apps/
    automotive.env.example   NON-SECRET per-app config template (copy to
                             automotive.env on the server and edit)
    <app>.env                real per-app config (generated/edited on server;
                             never committed)
  templates/
    nginx-site.conf          parameterized Nginx virtual host
  ecosystem.config.cjs       PM2: registers ONE independent process per
                             deploy/apps/<app>.env found
  setup-app.sh               provision a new application (dirs, Nginx vhost,
                             PostgreSQL DB + user, runtime secrets)
  rendered/                  setup-app.sh output (gitignored)
```

## Commands

```bash
# Render the Automotive virtual host without touching the system (safe test):
./deploy/setup-app.sh automotive --render-only

# Full provisioning for Automotive (run on the VPS as a sudo user):
./deploy/setup-app.sh automotive

# Add a FUTURE independent application (e.g. Motorcycle):
./deploy/setup-app.sh motorcycle --hostname moto.bennyblax.co.tz \
  --port 4001 --db-name bennyblax_motorcycle --db-user bennyblax_motorcycle
```

## How applications stay independent

| Concern            | Automotive                    | Motorcycle (future)              |
|--------------------|-------------------------------|----------------------------------|
| Source/build       | `/opt/bennyblax/apps/automotive` | `/opt/bennyblax/apps/motorcycle` |
| Deploy config      | `deploy/apps/automotive.env`  | `deploy/apps/motorcycle.env`     |
| Secrets            | `…/automotive/server/.env.production` | `…/motorcycle/server/.env.production` |
| PM2 process        | `bennyblax-automotive-api`    | `bennyblax-motorcycle-api`       |
| Internal API port  | 4000                          | 4001                             |
| Database / user    | `bennyblax_automotive`        | `bennyblax_motorcycle`           |
| Nginx vhost        | `automotive.conf`             | `motorcycle.conf`                |
| Hostname           | `auto.bennyblax.co.tz`        | `moto.bennyblax.co.tz`           |
| Logs               | `/var/log/bennyblax/automotive/` | `/var/log/bennyblax/motorcycle/` |
| Backups            | `/opt/bennyblax/backups/automotive/` | `/opt/bennyblax/backups/motorcycle/` |

Full documentation: [docs/MULTIAPP.md](../docs/MULTIAPP.md) and
[docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).