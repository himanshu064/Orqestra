/**
 * Deterministic pseudo-random helpers for the seed script.
 * mulberry32 gives a fast, well-distributed, fully reproducible sequence from a fixed seed,
 * so every reseed produces identical data (stable demos).
 */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive. */
export function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Float in [min, max). */
export function floatBetween(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/** Uniformly pick one element. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

/** True with probability p (0..1). */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Weighted pick: items with relative weights. */
export function weighted<T>(rng: Rng, entries: readonly [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [item, w] of entries) {
    r -= w;
    if (r <= 0) return item;
  }
  return entries[entries.length - 1]![0];
}

/** A Date `daysAgo` (± jitter days) before `now`. */
export function daysAgo(rng: Rng, now: Date, days: number, jitter = 0): Date {
  const d = days + (jitter ? intBetween(rng, -jitter, jitter) : 0);
  return new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
}
