import { Big } from "hjs-biginteger";

/** Parse exchange / CSV decimal strings (or numbers) without floating-point parse quirks. */
export function decimalFromUnknown(raw: unknown): number {
  if (raw === undefined || raw === null) return NaN;
  const s = String(raw).trim();
  if (s === "") return NaN;
  try {
    return new Big(s).toNumber();
  } catch {
    return NaN;
  }
}

/** a * b + c in decimal space, then coerced to number (for balance updates). */
export function decimalMulPlus(
  a: unknown,
  b: unknown,
  c: unknown = 0
): number {
  try {
    return new Big(String(a)).times(String(b)).plus(String(c)).toNumber();
  } catch {
    return NaN;
  }
}

/** a * b - c in decimal space. */
export function decimalMulMinus(
  a: unknown,
  b: unknown,
  c: unknown = 0
): number {
  try {
    return new Big(String(a)).times(String(b)).minus(String(c)).toNumber();
  } catch {
    return NaN;
  }
}

/** Optional third factor for e.g. price * size * feeRate. */
export function decimalTimes(
  a: unknown,
  b: unknown,
  c?: unknown
): number {
  try {
    let x = new Big(String(a)).times(String(b));
    if (c !== undefined) x = x.times(String(c));
    return x.toNumber();
  } catch {
    return NaN;
  }
}
