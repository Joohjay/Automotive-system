import type { Request, Response, NextFunction } from 'express';

import prisma from '../lib/prisma.js';
import { verifyAccessToken, toAuthUser } from '../lib/token.js';
import { AUTH_COOKIE_NAME } from './csrf.js';
import { ApiError } from './error.js';

function extractToken(req: Request): string | null {
  // httpOnly cookie is the primary transport for browser clients.
  const cookieToken = (req.cookies as Record<string, string | undefined> | undefined)?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  // Bearer header fallback keeps API clients and test harnesses working.
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

      // Fetch user + tokenVersion from DB to check revocation
      const user = await loadAuthUser(payload.sub);
      if (!user) throw ApiError.unauthorized('Account no longer exists');

      // Check token version — incremented on logout/password change
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true },
      });
      if (!dbUser || dbUser.tokenVersion !== payload.tv) {
        throw ApiError.unauthorized('Session has been invalidated. Please log in again.');
      }

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
      next(ApiError.forbidden('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}

export function hasPermission(user: NonNullable<Request['user']>, code: string) {
  return user.permissions.includes(code);
}