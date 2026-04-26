import crypto from 'crypto';

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function randomUrlSafeToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
