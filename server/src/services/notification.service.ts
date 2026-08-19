import prisma from '../lib/prisma.js';
import type { NotificationType } from '@prisma/client';

export interface CreateNotificationInput {
  userId: string;
  branchId?: string | null;
  type: NotificationType;
  title: string;
  message?: string;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Creates a notification unless an identical UNREAD notification already
 * exists for the same (userId, type, referenceId) - prevents duplicates on
 * repeated page loads.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      referenceId: input.referenceId ?? null,
      status: 'UNREAD',
    },
  });
  if (existing) return;

  await prisma.notification.create({ data: { ...input } });
}

export async function notifyStockStatus(
  branchId: string,
  productId: string,
  quantityOnHand: number,
  minStockLevel: number,
): Promise<void> {
  let type: NotificationType | null = null;
  if (quantityOnHand <= 0) type = 'OUT_OF_STOCK';
  else if (quantityOnHand <= minStockLevel) type = 'LOW_STOCK';

  if (!type) return;

  const users = await prisma.user.findMany({
    where: { branchId, status: 'ACTIVE' },
    select: { id: true },
  });
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, sku: true, partNumber: true },
  });
  if (!product) return;

  const partRef = product.partNumber ? ` (Part #${product.partNumber})` : '';
  const label = type === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock';
  for (const user of users) {
    await createNotification({
      userId: user.id,
      branchId,
      type,
      title: `${label}: ${product.name}`,
      message: `${product.name} (${product.sku})${partRef} has ${quantityOnHand} units on hand (minimum ${minStockLevel}).`,
      referenceType: 'PRODUCT',
      referenceId: productId,
    });
  }
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { status: 'UNREAD' as const } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<{ id: string; status: string } | null> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { status: 'READ', readAt: new Date() },
  });
  if (result.count === 0) return null;
  return prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true, status: true },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, status: 'UNREAD' },
    data: { status: 'READ', readAt: new Date() },
  });
}

/**
 * Brings OUT_OF_STOCK / LOW_STOCK notifications in line with the current
 * stock position for a branch (aggregated per product across locations,
 * including products with no inventory rows, which have zero on hand).
 *
 * - Creates an UNREAD notification for each product currently below minimum
 *   (or at zero) that has no matching UNREAD notification.
 * - Marks previous UNREAD stock notifications READ when the product has
 *   recovered above its minimum level, or when its status tier changed.
 *
 * Runs on successful login so the bell reflects the true state of stock.
 */
export async function reconcileStockNotifications(branchId: string): Promise<void> {
  const [products, inventoryRows, users] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, sku: true, partNumber: true, minStockLevel: true },
    }),
    prisma.inventory.findMany({
      where: { branchId },
      select: { productId: true, quantityOnHand: true },
    }),
    prisma.user.findMany({
      where: { branchId, status: 'ACTIVE' },
      select: { id: true },
    }),
  ]);

  if (users.length === 0) return;

  const stockByProduct = new Map<string, number>();
  for (const row of inventoryRows) {
    stockByProduct.set(row.productId, (stockByProduct.get(row.productId) ?? 0) + row.quantityOnHand);
  }

  const userIds = users.map((u) => u.id);
  const existing = await prisma.notification.findMany({
    where: {
      userId: { in: userIds },
      branchId,
      referenceType: 'PRODUCT',
      status: 'UNREAD',
    },
    select: { id: true, userId: true, referenceId: true, type: true },
  });
  const byProduct = new Map<string, typeof existing>();
  for (const n of existing) {
    const key = n.referenceId ?? '';
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key)!.push(n);
  }

  for (const product of products) {
    const qty = stockByProduct.get(product.id) ?? 0;
    let desiredType: 'OUT_OF_STOCK' | 'LOW_STOCK' | null = null;
    if (qty <= 0) desiredType = 'OUT_OF_STOCK';
    else if (qty <= product.minStockLevel) desiredType = 'LOW_STOCK';

    const notifs = byProduct.get(product.id) ?? [];

    for (const user of users) {
      const mine = notifs.filter((n) => n.userId === user.id);

      if (!desiredType) {
        if (mine.length > 0) {
          await prisma.notification.updateMany({
            where: { id: { in: mine.map((n) => n.id) }, userId: user.id },
            data: { status: 'READ', readAt: new Date() },
          });
        }
        continue;
      }

      const hasMatching = mine.some((n) => n.type === desiredType);
      if (hasMatching) continue;

      const stale = mine.map((n) => n.id);
      if (stale.length > 0) {
        await prisma.notification.updateMany({
          where: { id: { in: stale }, userId: user.id },
          data: { status: 'READ', readAt: new Date() },
        });
      }

      const partRef = product.partNumber ? ` (Part #${product.partNumber})` : '';
      const label = desiredType === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock';
      await createNotification({
        userId: user.id,
        branchId,
        type: desiredType,
        title: `${label}: ${product.name}`,
        message: `${product.name} (${product.sku})${partRef} has ${qty} units on hand (minimum ${product.minStockLevel}).`,
        referenceType: 'PRODUCT',
        referenceId: product.id,
      });
    }
  }
}