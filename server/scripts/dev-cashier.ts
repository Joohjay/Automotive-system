/**
 * Development-only helper: creates/updates the CASHIER-RBAC test user.
 * Used by the integration test suite and for manual RBAC checks.
 *
 * Usage: npm run db:cashier
 * Will only execute when NODE_ENV is development or test.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const nodeEnv = process.env.NODE_ENV ?? 'development';
if (nodeEnv === 'production') {
  console.error('[cashier] REFUSING to run in production.');
  process.exit(1);
}

async function main() {
  const role = await prisma.role.findUnique({ where: { name: 'CASHIER' } });
  const branch = await prisma.branch.findFirst({ where: { code: 'HQ' } });
  if (!role || !branch) throw new Error('Seed first: npm run db:seed');

  const hash = await bcrypt.hash('Cashier@123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'cashier.test@autoparts.local' },
    update: { passwordHash: hash, roleId: role.id, branchId: branch.id, status: 'ACTIVE' },
    create: {
      email: 'cashier.test@autoparts.local',
      passwordHash: hash,
      fullName: 'Cashier Test',
      roleId: role.id,
      branchId: branch.id,
      status: 'ACTIVE',
    },
  });
  console.log(`[cashier] ${user.email} ready (role ${role.name})`);
}

main()
  .catch((err) => {
    console.error('[cashier] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
