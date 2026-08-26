import * as OTPAuth from 'otpauth';

import { config } from '../config/env.js';
import { encrypt, decrypt } from '../lib/crypto.js';

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

/** Encrypt the TOTP secret before storing in the database. */
export function encryptSecret(secret: string): string {
  return encrypt(secret);
}

/** Decrypt the TOTP secret from the database for verification. */
export function decryptSecret(encrypted: string): string {
  return decrypt(encrypted);
}

export function verifyMfaToken(encryptedSecret: string, token: string): boolean {
  const secret = decryptSecret(encryptedSecret);
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
