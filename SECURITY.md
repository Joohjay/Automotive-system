# Security Policy — BennyBlax Enterprises AutoParts System

## Overview

This document describes the security measures implemented in the BennyBlax Enterprises automotive parts management system. It is intended for developers, administrators, and auditors.

---

## 1. Authentication & Authorization

| Control | Implementation |
|---------|---------------|
| **JWT tokens** | HS256 with algorithm pinning (`algorithms: ['HS256']`). Secret validated at startup (minimum 32 characters). Configurable expiry via `JWT_EXPIRES_IN`. |
| **Password hashing** | bcrypt with cost factor 12. |
| **Per-request auth check** | `requireAuth` middleware re-loads user from database on every request, verifying `ACTIVE` status and branch status. |
| **RBAC** | Role-based access control with granular permissions (e.g., `user.view`, `product.create`, `sale.refund`). Enforced via `requirePermission` middleware on all protected routes. |
| **Branch isolation** | Users are scoped to their branch. Cross-branch access is blocked at the middleware level. |

### Token payload

```json
{ "sub": "<userId>", "email": "<email>", "role": "<roleName>", "branchId": "<branchId>" }
```

No sensitive data (passwords, hashes, secrets) is included in the token.

---

## 2. Password Policy

| Rule | Enforcement |
|------|------------|
| Minimum 12 characters | Server (Zod) + client validation |
| At least 1 uppercase letter | Server (Zod) + client validation |
| At least 1 lowercase letter | Server (Zod) + client validation |
| At least 1 digit | Server (Zod) + client validation |
| At least 1 special character | Server (Zod) + client validation (`!@#$%^&*()_+-=[]{};':"\\|,.<>/?`) |

Password complexity is enforced on:
- User creation (`POST /api/users`)
- Self-service password change (`POST /api/auth/change-password`)
- Password reset via link (`POST /api/auth/reset-password`)

The admin password reset flow (`POST /api/users/:id/reset-password`) sends a reset link — the new password is validated when the user completes the reset.

---

## 3. Account Lockout

| Parameter | Value |
|-----------|-------|
| Failed attempt threshold | 5 consecutive failures |
| Lockout duration | 15 minutes |
| Reset condition | Successful login clears the counter |
| Scope | Per-user (database-tracked `failedLoginAttempts` + `lockedUntil`) |

Lockout state is checked before password comparison, preventing timing attacks on the hash comparison during lockout.

---

## 4. Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/login` | 10 requests | 60 seconds |
| `POST /api/auth/forgot-password` | 10 requests | 60 seconds |
| `POST /api/auth/reset-password` | 10 requests | 60 seconds |
| All `/api/*` routes | 300 requests | 60 seconds |

Rate limiting is IP-based via `express-rate-limit`. Behind a reverse proxy, `trust proxy` is enabled in production for accurate `req.ip`.

---

## 5. Audit Logging

All security-relevant actions are recorded in the `AuditLog` table:

| Action | Description |
|--------|------------|
| `LOGIN` | Successful login |
| `LOGOUT` | User logout |
| `FAILED_LOGIN` | Failed login attempt (wrong password, non-existent email, or locked account) |
| `PASSWORD_CHANGED` | Self-service password change |
| `PASSWORD_RESET_REQUESTED` | Forgot-password email requested |
| `PASSWORD_RESET_COMPLETED` | Password reset via link completed |
| `ADMIN_PASSWORD_RESET_INITIATED` | Admin sent password reset link |
| `USER_CREATED` | New user account created |
| `USER_UPDATED` | User profile updated |
| `USER_ACTIVATED` / `USER_DEACTIVATED` | Account status change |
| `ROLE_ASSIGNED` | Role changed |
| `BRANCH_ASSIGNED` | Branch changed |

Each audit entry includes: `userId`, `branchId`, `action`, `entityType`, `entityId`, `ipAddress`, `userAgent`, `createdAt`. Previous and new values are captured for data changes (passwords and tokens are never logged).

---

## 6. Password Reset Flow

1. User requests reset via email (`POST /api/auth/forgot-password`)
2. Server generates a 32-byte random token, stores only its SHA-256 hash in the database
3. Reset link sent via email (console-logged in dev mode)
4. Link expires after 1 hour
5. Token is single-use — marked as used upon completion
6. Atomic transaction: password hash update + token invalidation
7. Anti-enumeration: identical response regardless of email existence

---

## 7. Infrastructure Security

### Server-side

| Control | Details |
|---------|--------|
| **Helmet** | Security headers enabled in production (CSP, HSTS, X-Frame-Options, etc.) |
| **CORS** | Single-origin allowlist from `CLIENT_ORIGIN` env var |
| **Body size limit** | 1MB (`express.json`) |
| **Trust proxy** | Enabled in production for accurate client IP behind reverse proxy |
| **Error handling** | Stack traces never sent to clients. Structured `{ code, message, details? }` responses only. |
| **Request logging** | Morgan HTTP logger. No request body logging (passwords are never logged). |
| **Request ID** | Unique `x-request-id` header generated per request for tracing. |
| **Process guards** | `unhandledRejection` and `uncaughtException` handlers prevent silent crashes. |

### Client-side

| Control | Details |
|---------|--------|
| **React XSS** | Automatic JSX escaping. No `dangerouslySetInnerHTML` usage. |
| **Error boundary** | Catches rendering crashes. Shows generic message in production. |
| **Token handling** | Bearer token in `Authorization` header. Removed on logout and 401. |

### Database

| Control | Details |
|---------|--------|
| **Prisma ORM** | All queries use parameterized statements (SQL injection prevention) |
| **Raw queries** | Only 3 instances, all using Prisma template literals (parameterized) |
| **Transactions** | Security-critical operations (password reset, stock changes, sales) use `prisma.$transaction` |

---

## 8. Environment & Configuration

- All environment variables validated at startup via Zod schema
- Invalid config causes immediate `process.exit(1)` with descriptive errors
- `.env` files are gitignored (only `.env.example` is committed)
- `JWT_SECRET` requires minimum 32 characters
- Dev seed script refuses to run in production (`NODE_ENV === 'production'`)
- Dev-only routes are conditionally loaded

---

## 9. Known Security Debt (Deferred)

The following items are documented but not yet implemented. They should be addressed before production deployment.

| Item | Risk | Recommendation |
|------|------|---------------|
| **JWT stored in localStorage** | XSS-based token theft | Migrate to httpOnly cookies with `Secure`, `SameSite=Strict` |
| **No token revocation** | Stolen tokens remain valid until expiry | Implement token blacklist (Redis or DB) with `jti` claim |
| **No CSRF tokens** | Low risk (Bearer auth used) | Add if migrating to cookie-based sessions |
| **No input sanitization library** | Low risk (Prisma + React mitigate) | Add `express-mongo-sanitize` as defense-in-depth |
| **Lockout message leaks time** | Minor info leak | Change to generic "too many attempts" message |
| **No DB SSL enforcement** | Man-in-the-middle on DB connection | Add `sslmode=require` to `DATABASE_URL` in production |

---

## 10. Production Deployment Checklist

Before deploying to production:

- [ ] Generate a strong `JWT_SECRET` (`openssl rand -hex 64`)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `DATABASE_URL` with `sslmode=require`
- [ ] Set a unique, strong database password (not `autoparts`)
- [ ] Configure `CLIENT_ORIGIN` to the production domain
- [ ] Set up HTTPS via Nginx (see `docs/DEPLOYMENT.md`)
- [ ] Verify `trust proxy` is enabled (automatic in production)
- [ ] Change the admin password from the seed default
- [ ] Remove or disable the dev seed data
- [ ] Set up automated database backups (see `scripts/backup.sh`)
- [ ] Review audit logs regularly
- [ ] Monitor failed login patterns
- [ ] Set up email provider (SMTP) for password reset flows
- [ ] Review and customize Helmet CSP for your domain
- [ ] Consider implementing JWT revocation before handling sensitive data
