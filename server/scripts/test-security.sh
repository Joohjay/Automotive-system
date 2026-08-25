#!/usr/bin/env bash
# Stage 10.5 - security test harness.
# Sets up an isolated `autoparts_test` database (never touches the production
# database) and runs the integration security suite against a test server.
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PG_CTL="$HOME/.cache/autoparts-postgres/pg-18.4.0/bin/pg_ctl"
PG_DATA="$HOME/.local/share/autoparts-postgres/pgdata"

# Make sure the embedded postgres is running.
if [ -x "$PG_CTL" ]; then
  if ! "$PG_CTL" status -D "$PG_DATA" >/dev/null 2>&1; then
    "$PG_CTL" start -D "$PG_DATA" -l "$HOME/.local/share/autoparts-postgres/postgres.log" >/dev/null
  fi
fi

TEST_URL="$(node -e "require('dotenv').config({ path: process.argv[1] }); const u = process.env.DATABASE_URL; console.log(u.replace(/\/[^/?#]+(\?.*)?$/, '/autoparts_test\$1'))" "$SERVER_DIR/.env")"

cd "$SERVER_DIR"

# Create the test database if it does not exist (via a connection to the app database).
node -e "
require('dotenv').config({ path: process.argv[1] });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    await p.\$executeRawUnsafe('CREATE DATABASE \"autoparts_test\"');
  } catch (e) {
    if (!String(e.message).includes('already exists')) throw e;
  }
  await p.\$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
" "$SERVER_DIR/.env"

DATABASE_URL="$TEST_URL" npx prisma migrate deploy
DATABASE_URL="$TEST_URL" npx prisma db seed

node --test tests/security.integration.test.mjs