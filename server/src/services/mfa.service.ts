import * as OTPAuth from 'otpauth';

import { config } from '../config/env.js';

const ISSUER = 'BennyBlax Automotive';

export interface MfaSetupResult {
  secret: string;
  uri: string;
}

export function createMfaSecret(email: string): MfaSetupResult {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyMfaToken(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export function getIssuer(): string {
  return ISSUER;
}
