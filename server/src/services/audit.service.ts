import prisma from '../lib/prisma.js';

export interface AuditEntry {
  userId?: string;
  branchId?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Records an auditable action. `newValue` / `previousValue` must be sanitized
 * by callers - never pass passwords, tokens or other secrets.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      branchId: entry.branchId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      previousValue: entry.previousValue ?? undefined,
      newValue: entry.newValue ?? undefined,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}

/** Scalar, serialisable representation of a Prisma model row (used for audit diffs). */
export function scalarize<T extends object>(row: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key, value]) =>
        key !== 'passwordHash' &&
        value !== undefined &&
        typeof value !== 'object',
    ),
  );
}