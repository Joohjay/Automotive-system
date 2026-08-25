import jwt, { type SignOptions } from 'jsonwebtoken';

import { config } from '../config/env.js';
import type { AuthUser } from '../types/express.js';

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  branchId: string;
  tv: number; // tokenVersion for revocation
}

export function signAccessToken(user: {
  id: string;
  email: string;
  roleName: string;
  branchId: string;
  tokenVersion?: number;
}): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.roleName,
    branchId: user.branchId,
    tv: user.tokenVersion ?? 0,
  };

  const options: SignOptions = {};
  if (config.jwt.expiresIn !== '0') {
    options.expiresIn = config.jwt.expiresIn as SignOptions['expiresIn'];
  }

  return jwt.sign(payload, config.jwt.secret, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as TokenPayload;
}

export function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  role: { name: string };
  branchId: string;
  permissions: string[];
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roleId: user.roleId,
    roleName: user.role.name,
    branchId: user.branchId,
    permissions: user.permissions,
  };
}