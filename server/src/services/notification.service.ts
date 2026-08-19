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