// PM2 ecosystem for ALL BennyBlax applications.
//
// This file scans deploy/apps/*.env (one config file per independent
// application) and registers ONE independent PM2 process per application.
// It never assumes there is only one app, and a crash/restart of one app
// never affects any other app.
//
// Usage (from the server's deploy directory):
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save
//   pm2 startup
//
// Per-app config files are NON-SECRET infrastructure settings:
//   deploy/apps/automotive.env, deploy/apps/motorcycle.env, ...
// Secrets (JWT, DB password, SMTP) live in each app's runtime env file at
// <APP_PATH>/server/.env.production and are NOT read here — PM2 inherits
// them from the app's working directory, so never store them in the app
// config files.

'use strict';

const fs = require('fs');
const path = require('path');

function parseEnv(content) {
  const cfg = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    cfg[m[1]] = value;
  }
  return cfg;
}

function loadApps() {
  const appsDir = path.join(__dirname, 'apps');
  if (!fs.existsSync(appsDir)) return [];
  return fs
    .readdirSync(appsDir)
    .filter(
      (f) => f.endsWith('.env') && !f.endsWith('.env.example'),
    )
    .map((f) => parseEnv(fs.readFileSync(path.join(appsDir, f), 'utf8')))
    .filter((cfg) => cfg.APP_ID && cfg.APP_NAME && cfg.APP_PATH);
}

const apps = loadApps().map((app) => {
  if (!app.API_PORT) {
    throw new Error(
      `deploy/apps/${app.APP_ID}.env is missing API_PORT. Every application needs its own port.`,
    );
  }
  return {
    name: app.APP_NAME,
    cwd: path.join(app.APP_PATH, 'server'),
    script: 'dist/index.js',
    interpreter: 'node',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '512M',
    kill_timeout: 15000,
    listen_timeout: 5000,
    out_file: `/var/log/bennyblax/${app.APP_ID}/out.log`,
    error_file: `/var/log/bennyblax/${app.APP_ID}/err.log`,
    merge_logs: true,
    time: true,
  };
});

module.exports = { apps };