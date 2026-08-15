# Automotive Spare Parts Management, POS and Inventory System

A production-minded system for digitizing the daily operations of an automotive
spare-parts business: inventory control, point of sale (cash, M-Pesa, credit),
receipts, reporting and staff management. This is an internal business system,
not a customer-facing e-commerce site.

## Status

**Stage 2 — Database / ERD design (current).** The foundation is in place:

- Frontend and backend run independently.
- Backend connects to PostgreSQL through Prisma.
- `GET /api/health` reports API and database status.
- Full Stage 2 ERD implemented and migrated (32 business tables), with
  inventory-transaction ledger, data-driven RBAC, credit/loan modules and
  multi-branch readiness. See `docs/architecture.md` for the design.

Application features (auth, POS, inventory UI, reports) are **not** built yet —
they belong to later stages and will be built on this schema.

## Repository layout

```
.
├── client/                    # React + Vite + TypeScript + Tailwind frontend
│   └── src/
│       ├── components/        # Reusable UI and layout components
│       ├── pages/             # Route-level pages
│       ├── layouts/           # Application shell
│       ├── hooks/             # React hooks
│       ├── services/          # API client layer
│       ├── config/            # Centralized configuration (navigation, etc.)
│       ├── lib/               # Shared utilities
│       ├── types/             # Shared TypeScript types
│       └── utils/
├── server/                    # Express + TypeScript + Prisma backend
│   ├── src/
│   │   ├── config/            # Environment/config validation
│   │   ├── controllers/       # Request handlers
│   │   ├── middleware/        # CORS, logging, errors, auth (future)
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business logic (future)
│   │   ├── repositories/      # Data access layer (future)
│   │   ├── validators/        # Request validation (Zod) (future)
│   │   ├── lib/               # Shared infrastructure (Prisma client)
│   │   └── utils/
│   ├── prisma/
│   │   ├── schema.prisma      # Datasource + generator (models come in Stage 2)
│   │   └── migrations/
│   └── scripts/
│       └── dev-db.mjs         # Dev-only local PostgreSQL helper
└── docs/                      # Design and architecture documents
```

## Prerequisites

- **Node.js** >= 20.19
- **PostgreSQL** 14+ (a system server, Docker container, or hosted instance).
  If none is available, the included dev script downloads and runs a real
  PostgreSQL locally — see "Local development database" below.
- **npm** 9+

## Getting started

### 1. Backend

```bash
cd server
npm install

cp .env.example .env      # then edit values as needed
```

Ensure a PostgreSQL database exists and matches `DATABASE_URL`, then:

```bash
npm run prisma:generate   # generate the Prisma client
npm run dev               # start the API on http://localhost:4000
```

Verify: `curl http://localhost:4000/api/health`

```json
{ "status": "ok", "service": "autoparts-api", "database": "up", ... }
```

### 2. Frontend

```bash
cd client
npm install

cp .env.example .env      # VITE_API_URL points at the backend
npm run dev               # start the dev server on http://localhost:5173
```

## Local development database

The backend expects a reachable PostgreSQL at `DATABASE_URL`. On machines
without a system PostgreSQL (and no Docker), a dev-only script downloads the
official prebuilt PostgreSQL binaries and runs a real instance:

```bash
cd server
node scripts/dev-db.mjs up     # download binaries (first run) and start
node scripts/dev-db.mjs down   # stop it
```

It creates the role/database matching `.env.example`
(`postgresql://autoparts:autoparts@127.0.0.1:5432/autoparts`). Production and
shared environments use a real PostgreSQL server and do not need this script.

## Environment variables

All secrets and connection details are read from environment variables only.
Never commit `.env` files — they are ignored by Git.

| Variable         | Location | Purpose                                        |
| ---------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`   | server   | PostgreSQL connection string                   |
| `PORT`           | server   | API port (default 4000)                        |
| `CLIENT_ORIGIN`  | server   | Allowed CORS origin for the frontend           |
| `NODE_ENV`       | server   | development / test / production                |
| `VITE_API_URL`   | client   | Base URL of the backend API                    |

Templates: `server/.env.example`, `client/.env.example`.

## Database & Prisma workflow

The full Stage 2 ERD is implemented (see `docs/architecture.md`). Standard
workflow:

```bash
npm run prisma:migrate    # create and apply a migration
npm run prisma:generate   # regenerate the client after schema changes
npm run db:seed           # development-only seed (branch, roles, permissions, admin user, settings)
npm run prisma:studio     # visual database inspection (dev)
```

The seed creates one branch, the five system roles, a base permission set, a
development admin user (`admin@autoparts.local` / `Admin@12345`), a default
storage location, expense categories and default settings. It is idempotent and
is never run in production.

## Architecture decisions (Stage 1)

- **Modular monolith**: a single backend and single frontend, split into
  coherent layers. No microservices, no extra infrastructure. Multi-branch
  support is planned at the schema level (a `branches` concept) rather than via
  service decomposition.
- **Controlled inventory**: stock levels are never manually overwritten.
  `Inventory` holds current quantity while `InventoryTransaction` is the
  authoritative ledger (receiving, sale, return, damage, adjustment, transfer).
- **Centralized configuration**: environment variables are validated once at
  startup (`server/src/config/env.ts`) and fail fast if invalid.
- **Centralized error handling**: `ApiError` + a single error middleware
  produce consistent JSON errors; unknown endpoints return structured 404s.
- **Separation of concerns**: controllers stay thin, business logic will live in
  services, data access in repositories, and request validation in validators.

## Scripts

Backend (`cd server`):

| Command                    | Purpose                              |
| -------------------------- | ------------------------------------ |
| `npm run dev`              | Run API with hot reload (tsx watch)  |
| `npm run build`            | Compile TypeScript to `dist/`        |
| `npm run start`            | Run compiled output                  |
| `npm run typecheck`        | Type-check without emitting          |
| `npm run prisma:generate`  | Generate Prisma client               |
| `npm run prisma:migrate`   | Create and apply a migration         |
| `npm run db:seed`          | Development-only seed data           |
| `node scripts/dev-db.mjs up/down` | Start/stop local dev database |

Frontend (`cd client`):

| Command             | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Vite dev server                      |
| `npm run build`     | Type-check and production build      |
| `npm run preview`   | Preview the production build         |

## Testing

Test infrastructure (Vitest) will be added together with the first domain
module. The API is designed to be exercised with Postman-compatible requests.

## Security

- Helmet security headers, strict CORS allow-list, JSON body limits.
- Passwords will be hashed with bcrypt; sessions/JWT will be introduced with
  the authentication module.
- No secrets in the repository; environment validation fails fast on missing
  configuration.

## Roadmap

1. **Stage 2 (done)** — ERD and database schema implemented and migrated.
2. **Stage 3** — Authentication, users and roles (login, JWT/sessions, RBAC).
3. Inventory: parts, categories, brands, locations, receiving, transactions.
4. POS: cash, M-Pesa, credit, receipts.
5. Credit customers and balances.
6. Reporting and alerts.
7. Remote access hardening, backups, audit logging.
