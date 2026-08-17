/**
 * DEVELOPMENT-ONLY SEED.
 *
 * Seeds only safe reference/configuration data required to run and develop
 * the system. It does NOT create fake business data (no products, sales,
 * inventory, etc.).
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEV_ADMIN_EMAIL = 'admin@autoparts.local';
const DEV_ADMIN_PASSWORD = 'Admin@12345';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'STOREKEEPER'];

// Minimal permission catalogue. Expanded as modules are implemented.
const PERMISSIONS = [
  'dashboard.view',
  'product.view',
  'product.create',
  'product.update',
  'inventory.view',
  'inventory.adjust',
  'sale.create',
  'sale.view',
  'sale.void',
  'sale.return',
  'purchase.create',
  'purchase.view',
  'purchase.receive',
  'purchase.cancel',
  'supplier.view',
  'supplier.manage',
  'customer.view',
  'customer.manage',
  'credit.payment',
  'expense.create',
  'expense.view',
  'loan.view',
  'loan.manage',
  'report.view',
  'shift.open',
  'shift.close',
  'user.manage',
  'role.manage',
  'settings.manage',
] as const;

async function main() {
  console.log('[seed] starting (development-only data)...');

  // --- Branch ---
  const branch = await prisma.branch.upsert({
    where: { code: 'HQ' },
    update: {},
    create: {
      code: 'HQ',
      name: 'Head Office',
      address: 'Main Street, Dar es Salaam',
      status: 'ACTIVE',
    },
  });
  console.log('[seed] branch:', branch.code);

  // --- Roles ---
  const roleMap = new Map<string, string>();
  for (const name of ROLES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    });
    roleMap.set(name, role.id);
  }

  // --- Permissions ---
  const permissionIds: string[] = [];
  for (const code of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
    permissionIds.push(perm.id);
  }

  // --- Role permissions (OWNER + ADMIN get everything; others get a base set) ---
  const adminRoles = ['OWNER', 'ADMIN'];
  for (const [roleName, roleId] of roleMap) {
    const allowed = adminRoles.includes(roleName)
      ? permissionIds
      : permissionIds.filter((_, i) =>
          ['view', 'open', 'close', 'payment', 'receive', 'return'].some((s) =>
            PERMISSIONS[i]?.endsWith(s),
          ),
        );

    for (const permissionId of allowed) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  // --- Admin user (development only) ---
  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 12);
  const adminRoleId = roleMap.get('ADMIN') ?? roleMap.get('OWNER')!;
  await prisma.user.upsert({
    where: { email: DEV_ADMIN_EMAIL },
    update: { branchId: branch.id, roleId: adminRoleId, status: 'ACTIVE', fullName: 'CEO' },
    create: {
      fullName: 'CEO',
      email: DEV_ADMIN_EMAIL,
      passwordHash,
      branchId: branch.id,
      roleId: adminRoleId,
      status: 'ACTIVE',
    },
  });
  console.log(
    `[seed] admin user: ${DEV_ADMIN_EMAIL} (password: ${DEV_ADMIN_PASSWORD}) - DEVELOPMENT ONLY`,
  );

  // --- Default storage location ---
  await prisma.storageLocation.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'GEN' } },
    update: {},
    create: {
      branchId: branch.id,
      code: 'GEN',
      name: 'General Store',
      type: 'AREA',
    },
  });

  // --- Expense categories ---
  const expenseCategories = [
    'Rent',
    'Electricity',
    'Internet',
    'Transport',
    'Salaries',
    'Repairs',
    'Other',
  ];
  for (const name of expenseCategories) {
    const existing = await prisma.expenseCategory.findFirst({
      where: { name, branchId: branch.id },
    });
    if (!existing) {
      await prisma.expenseCategory.create({ data: { name, branchId: branch.id } });
    }
  }

  // --- Settings (global, branchId = null) ---
  const settings: Record<string, unknown> = {
    businessName: 'Blax Enterprises',
    currency: 'TZS',
    receiptFooter: 'Thank you for your business!',
  };
  for (const [key, value] of Object.entries(settings)) {
    const existing = await prisma.setting.findFirst({
      where: { key, branchId: null },
    });
    if (existing) {
      await prisma.setting.update({
        where: { id: existing.id },
        data: { value },
      });
    } else {
      await prisma.setting.create({ data: { key, value, branchId: null } });
    }
  }

  console.log('[seed] complete.');
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
