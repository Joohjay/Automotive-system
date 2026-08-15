import type { Request, Response, NextFunction } from 'express';

import prisma from '../lib/prisma.js';
import { verifyAccessToken, toAuthUser } from '../lib/token.js';
import { ApiError } from './error.js';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export async function loadAuthUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      branchId: true,
      roleId: true,
      role: {
        select: {
          name: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      },
      branch: { select: { status: true } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roleId: user.roleId,
    roleName: user.role.name,
    branchId: user.branchId,
    branchStatus: user.branch.status,
    userStatus: user.status,
    permissions: user.role.permissions.map((rp) => rp.permission.code),
  };
}

export function requireAuth(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> {
  return async (req, _res, next) => {
    try {
      const token = extractToken(req);
      if (!token) throw ApiError.unauthorized('Authentication required');

      const payload = verifyAccessToken(token);
      const user = await loadAuthUser(payload.sub);
      if (!user) throw ApiError.unauthorized('Account no longer exists');

      if (user.userStatus !== 'ACTIVE') {
        throw ApiError.forbidden('Account is not active');
      }
      if (user.branchStatus !== 'ACTIVE') {
        throw ApiError.forbidden('Account branch is not active');
      }

      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
        roleName: user.roleName,
        branchId: user.branchId,
        permissions: user.permissions,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requirePermission(code: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }
    if (!user.permissions.includes(code)) {
      next(ApiError.forbidden(`Permission required: ${code}`));
      return;
    }
    next();
  };
}

export function hasPermission(user: NonNullable<Request['user']>, code: string) {
  return user.permissions.includes(code);
}