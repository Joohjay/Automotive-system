#!/usr/bin/env node
/**
 * Dev-only helper that starts/stops a local PostgreSQL instance for
 * development, without requiring a system PostgreSQL, Docker or admin rights.
 *
 * It downloads the official prebuilt PostgreSQL binaries (zonky build of the
 * real PostgreSQL server) into ~/.cache/autoparts-postgres and keeps the
 * cluster data in server/.pgdata. Nothing in the application depends on this
 * file - production and shared environments use a real PostgreSQL server and
 * simply point DATABASE_URL at it.
 *
 * Usage:
 *   node scripts/dev-db.mjs up      # download binaries (first run) and start
 *   node scripts/dev-db.mjs down    # stop the local instance
 *
 * Binaries are cached in ~/.cache/autoparts-postgres and the cluster data
 * lives in ~/.local/share/autoparts-postgres (PostgreSQL refuses to run on
 * filesystems that do not honour 0700 directory permissions, e.g. some
 * Windows-mounted drives).
 *
 * The role/database it creates match server/.env.example:
 *   postgresql://autoparts:autoparts@127.0.0.1:5432/autoparts
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { get } from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR =
  process.env.DEV_DB_DATA_DIR ??
  path.join(os.homedir(), '.local', 'share', 'autoparts-postgres', 'pgdata');
const LOG_FILE = path.join(DATA_DIR, 'postgres.log');

const PG_VERSION = '18.4.0';
const CACHE_DIR = path.join(os.homedir(), '.cache', 'autoparts-postgres');
const JAR_PATH = path.join(CACHE_DIR, `pg-${PG_VERSION}.jar`);
const BIN_DIR = path.join(CACHE_DIR, `pg-${PG_VERSION}`);
const INITDB = path.join(BIN_DIR, 'bin', 'initdb');
const PG_CTL = path.join(BIN_DIR, 'bin', 'pg_ctl');
const JAR_URL = `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-linux-amd64/${PG_VERSION}/embedded-postgres-binaries-linux-amd64-${PG_VERSION}.jar`;

const PGHOST = process.env.DEV_DB_HOST ?? '127.0.0.1';
const PGPORT = Number(process.env.DEV_DB_PORT ?? 5432);
const PGUSER = process.env.DEV_DB_USER ?? 'autoparts';
const PGPASSWORD = process.env.DEV_DB_PASSWORD ?? 'autoparts';
const PGDATABASE = process.env.DEV_DB_DATABASE ?? 'autoparts';

const command = process.argv[2] ?? 'up';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed with exit code ${result.status}`);
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        downloadFile(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`download failed: HTTP ${res.statusCode} (${url})`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

const PY_EXTRACT = `
import io, sys, tarfile, zipfile
jar, dest = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(jar) as z:
    name = next(n for n in z.namelist() if n.endswith('.txz'))
    data = z.read(name)
with tarfile.open(fileobj=io.BytesIO(data), mode='r:xz') as t:
    t.extractall(dest)
print('extracted binaries to', dest)
`;

async function ensureBinaries() {
  if (existsSync(INITDB)) return;
  mkdirSync(CACHE_DIR, { recursive: true });
  if (!existsSync(JAR_PATH)) {
    console.log(`[db] downloading PostgreSQL ${PG_VERSION} binaries...`);
    await downloadFile(JAR_URL, JAR_PATH);
  }
  console.log('[db] extracting binaries...');
  run('python3', ['-c', PY_EXTRACT, JAR_PATH, BIN_DIR]);
}

function ensureDataDir() {
  if (existsSync(path.join(DATA_DIR, 'PG_VERSION'))) return;
  mkdirSync(DATA_DIR, { recursive: true });
  const pwFile = path.join(os.tmpdir(), `autoparts-pg-pw-${process.pid}`);
  writeFileSync(pwFile, PGPASSWORD);
  try {
    console.log('[db] initialising PostgreSQL data directory...');
    run(INITDB, [
      '-D', DATA_DIR,
      '-U', PGUSER,
      '--pwfile', pwFile,
      '--auth-local=trust',
      '--auth-host=scram-sha-256',
      '-E', 'UTF8',
    ]);
  } finally {
    rmSync(pwFile, { force: true });
  }
}

async function startServer() {
  const opts = `-p ${PGPORT} -c listen_addresses=${PGHOST}`;
  const result = spawnSync(
    PG_CTL,
    ['-D', DATA_DIR, '-l', LOG_FILE, '-o', opts, 'start'],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error('pg_ctl start failed');
}

async function ensureDatabase() {
  const client = new Client({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [PGDATABASE],
    );
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${PGDATABASE}"`);
      console.log(`[db] created database "${PGDATABASE}"`);
    }
  } finally {
    await client.end();
  }
}

async function up() {
  await ensureBinaries();
  ensureDataDir();
  await startServer();
  await ensureDatabase();
  console.log(
    `[db] PostgreSQL ${PG_VERSION} ready at ${PGHOST}:${PGPORT}`,
  );
  console.log(`[db] connection string: postgresql://${PGUSER}:***@${PGHOST}:${PGPORT}/${PGDATABASE}`);
}

async function down() {
  const result = spawnSync(
    PG_CTL,
    ['-D', DATA_DIR, 'stop', '-m', 'fast'],
    { stdio: 'inherit' },
  );
  if (result.status === 0) console.log('[db] PostgreSQL stopped');
}

if (command === 'down') {
  await down();
} else {
  try {
    await up();
  } catch (err) {
    console.error('[db] failed to start:', err.message);
    process.exitCode = 1;
  }
}
