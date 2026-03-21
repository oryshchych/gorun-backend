/**
 * Parse JWT-style expiry strings (e.g. "7d", "30d", "24h", "3600s", "15m") to milliseconds.
 */
export function parseExpiryToMs(expiry: string): number {
  const trimmed = expiry.trim();
  const match = /^(\d+)([smhd])$/i.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid expiry format: ${expiry}`);
  }
  const [, numStr, unitRaw] = match;
  const n = parseInt(numStr!, 10);
  const unit = unitRaw!.toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  const mult = multipliers[unit];
  if (mult === undefined) {
    throw new Error(`Invalid expiry unit: ${unit}`);
  }
  return n * mult;
}

export function expiryToDate(expiry: string): Date {
  return new Date(Date.now() + parseExpiryToMs(expiry));
}
