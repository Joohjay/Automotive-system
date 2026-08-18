# Deployment Guide

BennyBlax Enterprises — Automotive Spare Parts Management System

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
| `PORT` | No | API port (default: 4000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Random secret, 32+ chars. Generate: `openssl rand -hex 64` |
| `JWT_EXPIRES_IN` | No | Token lifetime (default: `8h`) |
| `CLIENT_ORIGIN` | Yes | Frontend URL, e.g. `https://app.example.com` |

### Frontend (client/.env.production — set at build time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL, e.g. `https://api.example.com/api` |

---

## 4. Production Setup

### 4.1 Create Production Database

```bash
sudo -u postgres psql
```

```sql
CREATE USER autoparts WITH PASSWORD 'your-strong-password-here';
CREATE DATABASE autoparts_prod OWNER autoparts;
GRANT ALL PRIVILEGES ON DATABASE autoparts_prod TO autoparts;
\q
```

### 4.2 Clone and Configure

```bash
cd /var/www
git clone https://github.com/Joohjay/Automotive-system.git autoparts
cd autoparts

# Backend environment
cp server/.env.example server/.env
# Edit server/.env with production values:
#   NODE_ENV=production
#   DATABASE_URL=postgresql://autoparts:your-strong-password@localhost:5432/autoparts_prod
#   JWT_SECRET=<generate with: openssl rand -hex 64>
#   CLIENT_ORIGIN=https://app.example.com
```

### 4.3 Install Dependencies and Build

```bash
# Backend
cd server
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run build

# Frontend
cd ../client
npm ci
VITE_API_URL=https://api.example.com/api npm run build
```

### 4.4 Start Production Server

```bash
cd /var/www/autoparts/server
NODE_ENV=production node dist/index.js
```

---

## 5. Process Management (PM2)

```bash
npm install -g pm2

cd /var/www/autoparts/server
pm2 start dist/index.js --name autoparts-api \
  --env production \
  --max-memory-restart 512M \
  --log-date-format "YYYY-MM-DD HH:mm:ss"

pm2 save
pm2 startup  # Follow the printed command to enable auto-restart on reboot
```

### PM2 Commands

```bash
pm2 list                  # List all processes
pm2 logs autoparts-api    # View logs
pm2 restart autoparts-api # Restart
pm2 stop autoparts-api    # Stop
pm2 delete autoparts-api  # Remove
pm2 monit                 # Real-time monitoring
```

---

## 6. Reverse Proxy (Nginx)

```bash
sudo apt install -y nginx
```

### /etc/nginx/sites-available/autoparts

```nginx
# Frontend (static files)
server {
    listen 80;
    server_name app.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # SPA: serve index.html for all routes
    root /var/www/autoparts/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 1m;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/autoparts /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx

# Frontend domain
sudo certbot certonly --nginx -d app.example.com

# API domain
sudo certbot certonly --nginx -d api.example.com

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

### Automated Daily Backup (cron)

```bash
# Edit crontab
crontab -e

# Add: daily backup at 2 AM
0 2 * * * DATABASE_URL="postgresql://autoparts:password@localhost:5432/autoparts_prod" /var/www/autoparts/scripts/backup.sh >> /var/log/autoparts-backup.log 2>&1
```

### Manual Backup

```bash
DATABASE_URL="postgresql://autoparts:password@localhost:5432/autoparts_prod" \
  ./scripts/backup.sh
```

Backups are stored in `./backups/` as compressed SQL files. The script retains the last 30 backups automatically.

### Restore

```bash
# ALWAYS test on a separate database first!
createdb -U autoparts autoparts_test
DATABASE_URL="postgresql://autoparts:password@localhost:5432/autoparts_test" \
  ./scripts/restore.sh backups/autoparts_20260818_020000.sql.gz

# Production restore (DANGEROUS — overwrites data)
DATABASE_URL="postgresql://autoparts:password@localhost:5432/autoparts_prod" \
  ./scripts/restore.sh backups/autoparts_20260818_020000.sql.gz
```

### Off-site Backup

Copy backups to external storage regularly:

```bash
# Example: copy to S3-compatible storage
aws s3 sync ./backups/ s3://your-backup-bucket/autoparts/ --storage-class STANDARD_IA

# Or rsync to a remote server
rsync -avz ./backups/ backup-user@remote-server:/backups/autoparts/
```

---

## 10. Database Migration Procedure

```bash
cd /var/www/autoparts/server

# Run pending migrations
npx prisma migrate deploy

# Generate Prisma client (if schema changed)
npx prisma generate

# Restart the server
pm2 restart autoparts-api
```

**Important:** Never run `prisma migrate dev` or `prisma migrate reset` in production.

---

## 11. Updating the Application

```bash
cd /var/www/autoparts

# Pull latest code
git pull origin main

# Backend
cd server
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart autoparts-api

# Frontend
cd ../client
npm ci
VITE_API_URL=https://api.example.com/api npm run build
# Nginx serves the new dist/ automatically

# Verify
curl -s https://api.example.com/api/health
```

---

## 12. Log Management

PM2 logs are stored in `~/.pm2/logs/`. To prevent disk exhaustion:

```bash
# Install logrotate
sudo apt install -y logrotate

# Create /etc/logrotate.d/autoparts
/var/www/autoparts/logs/*.log {
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
curl -s https://api.example.com/api/health | jq

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

## 14. First-Time Production Setup

After deploying to a fresh database:

```bash
# Run the seed script (creates admin, roles, permissions)
cd /var/www/autoparts/server
NODE_ENV=production npm run db:seed
```

**Important:** The seed script refuses to run in production by default. To run it once in production, temporarily set `NODE_ENV=development` in the seed script's environment, or use:

```bash
NODE_ENV=development npx tsx prisma/seed.ts
```

After seeding, immediately change the admin password via the UI. The default admin credentials are:
- Email: `admin@autoparts.local`
- Password: `Admin@12345`

---

## 15. Emergency Rollback

```bash
# Rollback database (if a migration caused issues)
# Check migration history
npx prisma migrate status

# Restore from backup (see Section 9)
# Rollback code
git log --oneline -10  # Find the last good commit
git checkout <commit-hash>
# Rebuild and restart (see Section 11)
```

---

## 16. Architecture Overview

```
Internet
   ↓
DNS (A records for app.example.com, api.example.com)
   ↓
HTTPS (Let's Encrypt / Certbot)
   ↓
Nginx (reverse proxy)
   ├── app.example.com → /var/www/autoparts/client/dist (static SPA)
   └── api.example.com → proxy_pass http://127.0.0.1:4000
                              ↓
                        Node.js (PM2)
                        Express 5 + Prisma
                              ↓
                        PostgreSQL (autoparts_prod)
```

---

## 17. Quick Reference Commands

```bash
# Start everything
pm2 restart all

# Check API health
curl -s http://localhost:4000/api/health

# View logs
pm2 logs autoparts-api

# Database shell
psql -U autoparts -d autoparts_prod

# Run migrations
cd server && npx prisma migrate deploy

# Rebuild frontend
cd client && VITE_API_URL=https://api.example.com/api npm run build

# Backup
DATABASE_URL="..." ./scripts/backup.sh

# Restore
DATABASE_URL="..." ./scripts/restore.sh backups/<file>.sql.gz
```
