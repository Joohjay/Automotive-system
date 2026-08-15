/**
 * Development-only reset of transactional data (sales, returns, purchases,
 * suppliers, customers, credit, inventory, notifications, audit logs).
 *
 * Keeps seed data intact: branch, roles, permissions, admin user, default
 * storage location, categories/brands are NOT touched.
 *
 * Usage: npm run db:clean
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isDev) {
    console.error('[cleanup] refusing to run outside development');
    process.exit(1);
  }

  const order = [
    ['Payment', () => prisma.payment.deleteMany({})],
    ['ReturnItem', () => prisma.returnItem.deleteMany({})],
    ['Return', () => prisma.return.deleteMany({})],
    ['SaleItem', () => prisma.saleItem.deleteMany({})],
    ['Sale', () => prisma.sale.deleteMany({})],
    ['CreditPayment', () => prisma.creditPayment.deleteMany({})],
    ['CreditAccount', () => prisma.creditAccount.deleteMany({})],
    ['Customer', () => prisma.customer.deleteMany({})],
    ['PurchaseItem', () => prisma.purchaseItem.deleteMany({})],
    ['Purchase', () => prisma.purchase.deleteMany({})],
    ['Supplier', () => prisma.supplier.deleteMany({})],
    ['InventoryTransaction', () => prisma.inventoryTransaction.deleteMany({})],
    ['Inventory', () => prisma.inventory.deleteMany({})],
    ['Notification', () => prisma.notification.deleteMany({})],
    ['AuditLog', () => prisma.auditLog.deleteMany({})],
  ] as const;

  for (const [name, fn] of order) {
    const res = await fn();
    console.log(`[cleanup] ${name}: ${res.count} deleted`);
  }
}

main()
  .catch((err) => {
    console.error('[cleanup] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
