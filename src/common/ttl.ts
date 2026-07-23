const MULTIPLIERS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;

export function ttlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/i.exec(ttl.trim());
  if (!match) {
    return DEFAULT_MS;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  return value * (MULTIPLIERS[unit] ?? DEFAULT_MS);
}
