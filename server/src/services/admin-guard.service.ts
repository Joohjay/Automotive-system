import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';

const ADMIN_ROLE_NAMES = ['OWNER', 'ADMIN'];

export async function countActiveAdmins(
  excludeUserId?: string,
  branchId?: string,
): Promise<number> {
  return prisma.user.count({
    where: {
      status: 'ACTIVE',
      role: { name: { in: ADMIN_ROLE_NAMES } },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      ...(branchId ? { branchId } : {}),
    },
  });
}

export async function isAdminRole(roleId: string): Promise<boolean> {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
  return !!role && ADMIN_ROLE_NAMES.includes(role.name);
}

/**
 * Throws a 409 conflict when the operation would leave the system with zero
 * active OWNER/ADMIN users. Only relevant when the target is an active admin
 * who would stop being an active admin after the change.
 */
export async function assertKeepsActiveAdmin(opts: {
  targetUserId: string;
  currentRoleId?: string;
  newRoleId?: string;
  becomesInactive?: boolean;
  branchId?: string;
}): Promise<void> {
  const currentRoleId =
    opts.currentRoleId ??
    (await prisma.user.findUnique({ where: { id: opts.targetUserId }, select: { roleId: true } }))
      ?.roleId;
  if (!currentRoleId) return;
  if (!(await isAdminRole(currentRoleId))) return;

  const newRoleId = opts.newRoleId ?? currentRoleId;
  const staysAdmin = !opts.becomesInactive && (await isAdminRole(newRoleId));
  if (staysAdmin) return;

  const remaining = await countActiveAdmins(opts.targetUserId, opts.branchId);
  if (remaining === 0) {
    throw ApiError.conflict(
      'This action would leave the system without an active administrator',
    );
  }
}

/**
 * Guards branch deactivation: blocking when every active administrator in the
 * system belongs to the branch being deactivated.
 */
export async function assertBranchKeepsActiveAdmin(branchId: string): Promise<void> {
  const total = await countActiveAdmins();
  if (total === 0) return;
  const inBranch = await countActiveAdmins(undefined, branchId);
  if (inBranch === total) {
    throw ApiError.conflict(
      'Deactivating this branch would leave the system without an active administrator',
    );
  }
}