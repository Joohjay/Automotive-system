# Security Hardening & Verification Report

Stage 10.5. Audit performed: 2026-08-20 against the deployed BennyBlax Automotive
Spare Parts Management System (server `dist/index.js` on :4100, client served on :5174).

## Scope & method

Reviewed every layer of the stack: authentication, password handling, JWT lifecycle,
CSRF, RBAC, branch isolation (IDOR), input validation, financial/inventory integrity,
error handling, transport headers/CORS, rate limiting, audit logging, dependency risk,
environment secret handling, and the live deployment. Fixes were verified with an
automated integration security suite plus unit tests; the production stack was
smoke-tested end to end.

## Already strong (verified, no change needed)

- **Login hardening** (`auth.controller.ts`): bcrypt cost 12; timing equalization with a
  dummy bcrypt compare on unknown-email and locked-account paths; generic
  `Invalid email or password`; 5-attempt / 15-minute lockout; failure counters
  incremented even for unknown emails (anti-enumeration). Audit events for
  FAILED_LOGIN / LOGIN / LOGOUT.
- **Password reset**: 256-bit random tokens stored only as SHA-256 hashes, 1-hour expiry,
  single-use, consumed inside a transaction; forgot-password always returns a generic
  message. Both endpoints sit behind the login rate limiter.
- **Session auth** (`middleware/auth.ts`): JWT signature verified with a strict
  `algorithms: ['HS256']` allow-list; the user (status, role, permissions, branch) is
  **reloaded from the DB on every request**, so role/branch/status changes take effect
  immediately and stale tokens cannot outlive a demotion.
- **CSRF**: double-submit cookie + `X-CSRF-Token` on all unsafe methods; CSRF and auth
  cookies are `httpOnly`/`SameSite=Lax` (`secure` in production). Change-password is
  CSRF-protected; the exempt list covers only login/forgot/reset (stateless flows).
- **Branch isolation**: every branch-scoped controller scopes `findFirst`/`findMany`
  by `branchId: req.user!.branchId` (e.g. `sale.controller.ts:74`, `purchase.controller.ts:69`,
  `loan.controller.ts:68`, `customer.controller.ts:69`); shared/global records use an
  explicit `OR: [{ branchId }, { branchId: null }]`. Cross-branch reads return 404.
- **RBAC**: all admin-capable routes enforce `requirePermission(...)` server-side
  (`users`, `branches`, `roles`, `settings.*` are OWNER/ADMIN-gated via the seed
  `ADMIN_ONLY_PREFIXES`); resources verify the actor's permissions from the DB each
  request, never from the client.
- **Financial/inventory integrity** (`sale.controller.ts`, `purchase.controller.ts`):
  line subtotals, discount bounds, totals and change are recomputed server-side with
  `Prisma.Decimal`; negative totals and over-limit credit are rejected; stock movement
  is transactional; voids are same-day-only and reverse stock + credit atomically.
- **Error handling**: consistent JSON errors, no stack traces to clients, Prisma/Zod/JWT
  errors mapped to safe messages; unknown routes 404.
- **Headers/CORS**: Helmet (CSP in production), CORS restricted to `CLIENT_ORIGIN`
  with credentials, 1 MB JSON body limit, global 300 req/min + 10/min login limiters.
- **Env guards** (`config/env.ts`): production refuses to boot with a placeholder/weak
  JWT secret, `console` email provider, missing SMTP, or non-`https://` client origin.
  Production never mounts the `/_dev` router.
- **Audit coverage**: mutations across users/branches/products/sales/purchases/customers/
  loans/expenses/returns/inventory all call `recordAudit` with actor, branch, IP, UA,
  previous/new values.
- **Deployment quirk (verified)**: the built client calls `http://localhost:4100/api`
  directly (baked from `.env.production`), which is why it works on this PC despite the
  5174 static server having no proxy. The VPS build (no `VITE_API_URL`) uses same-origin
  `/api` behind nginx — both paths are correct.

## Vulnerabilities found and fixed

1. **Admin privilege escalation (Medium — fixed)**
   The seed granted `ADMIN` the full permission set including `user.edit`, and
   `user.controller` had no check preventing an `ADMIN` from resetting the OWNER's
   password (`/users/:id/password-reset`) or granting themselves / others the `OWNER`
   role. The active-admin guard only protected the *last* admin, not escalation.
   **Fix** (`services/admin-guard.service.ts` + `controllers/user.controller.ts`): new
   `assertCanManageAdminAccount(actorRole, targetRole)` — only an `OWNER` may create,
   update, reassign role/branch, activate/deactivate, or reset the password of
   OWNER/ADMIN accounts. `ADMIN` still fully manages regular staff. Verified by
   integration tests 12–17.

2. **Seed admin role precedence (Low — fixed)**
   `prisma/seed.ts` assigned the seed admin the `ADMIN` role (`ADMIN ?? OWNER`), so a
   fresh provision produced a non-superuser admin. **Fix**: prefer `OWNER`.

3. **Weak/static JWT secret (fixed)**
   The production `server/.env` `JWT_SECRET` was rotated to a fresh 96-char random value
   (generated and written in place; never printed). Logged-in sessions were invalidated
   by design as part of the rotation.

4. **Rate-limit tuning (improvement)**
   `AUTH_LOGIN_LIMIT` / `AUTH_GLOBAL_LIMIT` are now configurable via environment
   (defaults unchanged: 10/min and 300/min), which also lets the test harness avoid
   tripping the limiter.

## Evaluated and accepted (documented)

- **Stateless JWT revocation**: logout clears the cookie and the client discards its
  token, but a stolen bearer token stays valid until the 8 h expiry. The per-request
  DB reload bounds the blast radius (revoked/deactivated users are rejected
  immediately). A server-side session table is the natural next step if revocation-on-
  logout is ever required.
- **Client-supplied unit price**: a cashier holding `sale.create` may price-adjust;
  the server still forbids negative totals, discount > subtotal, under-payment, and
  credit-limit breaches. This is a business control, not a technical vulnerability.
- **Inactive-account message** reveals account existence only to someone who already
  knows the correct password.
- **`npm audit` could not run** from this environment (npm registry unreachable).
  Run `npm audit` in `server/` and `client/` from a networked machine before the VPS
  deployment; no direct upgrade was made blind.

## Automated tests

New — run with the Node built-in test runner (no new dependencies).

- `server/tests/security.integration.test.mjs` (22 tests) against an isolated
  `autoparts_test` database: CSRF enforcement, generic login failures, lockout, RBAC,
  OWNER-only admin management (incl. reset/self-promote/demote/create attempts),
  MANAGER read-only isolation, forgot-password non-enumeration.
- `server/tests/unit/admin-guard.test.ts` + `password-policy.test.ts` (9 tests):
  pure logic for the escalation guard and the relaxed (min 8-char) password policy.

Run:
```
cd server
npm test            # unit tests (no DB)
npm run test:security   # full integration harness (creates + seeds autoparts_test)
```

## Deployment verification

- Backend (`node dist/index.js`, dev-mode config as deployed) started on :4100; the
  browser flow (CSRF cookie → login → cookie session → `/auth/me`) returned 200 with
  the restored OWNER role and all 35 permissions using the rotated JWT secret.
- Frontend (`python3 -m http.server 5174`) served the freshly built bundle.
- All test processes stopped afterwards and the isolated `autoparts_test` database was
  dropped; the environment is back to the pre-audit state (nothing running). Production
  database untouched by tests; the production admin account was verified restored to
  `OWNER` / `System Owner` with the working `Blax2026` password.
- `start-automotive.sh` and the Windows Task Scheduler setup were **not modified**.

## Residual recommendations

- Run `npm audit` (and `npm install`/upgrade) with network access before the VPS cutover.
- Set `NODE_ENV=production` + SMTP + `https://` origin and a fresh
  `openssl rand -hex 64` JWT secret on the VPS (the `deploy/` templates already assume
  this).
- Optionally move to server-side session storage to support logout revocation.