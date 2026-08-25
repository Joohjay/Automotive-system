/**
 * Provision the production OWNER/admin account securely.
 *
 * Usage (on the production server):
 *   ADMIN_EMAIL=owner@example.com \
 *   ADMIN_FULL_NAME="Benny Blax" \
 *   ADMIN_PASSWORD="<strong-12+-char-password>" \
 *   npx tsx scripts/provision-admin.ts
 *
 * If ADMIN_PASSWORD is omitted, a strong random password is generated and
 * printed to stdout exactly once — copy it and never commit it.
 *
 * This is the ONLY supported way to create the initial admin on a fresh
 * production database. The dev seed (prisma/seed.ts) refuses to run in
 * production and must not be used there.
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'Admin@12345';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const fullName = process.env.ADMIN_FULL_NAME?.trim() || 'System Owner';
let password = process.env.ADMIN_PASSWORD;

if (!email) {
  console.error('[provision-admin] ERROR: ADMIN_EMAIL is required.');
  process.exit(1);
}

if (password && (password === DEV_PASSWORD || password.length < 8)) {
  console.error(
    '[provision-admin] ERROR: ADMIN_PASSWORD must be at least 8 characters and must NOT be the development password.',
  );
  process.exit(1);
}

const generated = !password;
if (!password) {
  password = crypto.randomBytes(18).toString('base64url');
}

const role = await prisma.role.findUnique({ where: { name: 'OWNER' } });
if (!role) {
  console.error(
    '[provision-admin] ERROR: OWNER role not found. Run `npx prisma migrate deploy` before provisioning.',
  );
  process.exit(1);
}

const branch = await prisma.branch.findFirst({
  where: { status: 'ACTIVE' },
  orderBy: { createdAt: 'asc' },
});
if (!branch) {
  console.error(
    '[provision-admin] ERROR: No active branch found. Create a branch before provisioning.',
  );
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);

const user = await prisma.user.upsert({
  where: { email },
  update: {
    fullName,
    roleId: role.id,
    branchId: branch.id,
    status: 'ACTIVE',
    passwordHash,
    mustChangePassword: false,
    lockedUntil: null,
    failedLoginAttempts: 0,
  },
  create: {
    email,
    fullName,
    roleId: role.id,
    branchId: branch.id,
    status: 'ACTIVE',
    passwordHash,
  },
});

console.log(
  `[provision-admin] Admin ready: ${user.email} (OWNER, branch "${branch.name}")`,
);
if (generated) {
  console.log(
    '[provision-admin] Generated password (shown exactly once — store securely, then delete this output):',
  );
  console.log(password);
} else {
  console.log('[provision-admin] Password set from ADMIN_PASSWORD.');
}

await prisma.$disconnect();