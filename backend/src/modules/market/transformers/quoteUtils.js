// src/modules/market/transformers/quoteUtils.js
// Robust parsing utilities for multi-provider quote normalization

/**
 * Checks if a value is missing / placeholder.
 * Returns true for: null, undefined, NaN, "", "N/A", "n/a", "--", "—"
 */
export function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '--' || trimmed === '—') return true;
    if (trimmed.toLowerCase() === 'n/a') return true;
  }
  return false;
}

/**
 * Safe float parser. Returns null for anything missing.
 */
export function parseNumber(value) {
  if (isMissing(value)) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parse Yahoo-specific number formats.
 * Handles compact notation (5.56T, 302.97B, 136.89M, 1.23K) and plain numbers.
 */
export function parseYahooNumber(value) {
  if (isMissing(value)) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const cleaned = String(value).replace(/,/g, '').trim();
  return parseCompactNumber(cleaned);
}

/**
 * Strip percentage sign and return numeric value.
 * "63.66%" -> 63.66
 * "0.44%" -> 0.44
 * Does NOT convert to decimal (i.e. 63.66 stays 63.66, not 0.6366).
 */
export function parsePercentage(value) {
  if (isMissing(value)) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parse compact number notation:
 *   5.56T  -> 5_560_000_000_000
 *   302.97B -> 302_970_000_000
 *   136.89M -> 136_890_000
 *   45.2K  -> 45_200
 *   1.00   -> 1
 */
export function parseCompactNumber(value) {
  if (isMissing(value)) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const cleaned = String(value).replace(/,/g, '').trim();
  const match = cleaned.match(/^([+-]?[\d.]+)\s*([TMBK]?)$/i);
  if (!match) {
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  let num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;

  const suffix = match[2].toUpperCase();
  if (suffix === 'T') num *= 1_000_000_000_000;
  else if (suffix === 'B') num *= 1_000_000_000;
  else if (suffix === 'M') num *= 1_000_000;
  else if (suffix === 'K') num *= 1_000;

  return num;
}

/**
 * Parse bid/ask string formats:
 *   "207.55 x 4000"    -> { price: 207.55, size: 4000 }
 *   "207.55 x 4,000"   -> { price: 207.55, size: 4000 }
 *   "207.55x4000"       -> { price: 207.55, size: 4000 }
 *   "207.55"            -> { price: 207.55, size: null }
 *   207.55 (number)     -> { price: 207.55, size: null }
 */
export function parseBidAsk(value) {
  if (isMissing(value)) return { price: null, size: null };
  if (typeof value === 'number') {
    return { price: Number.isFinite(value) ? value : null, size: null };
  }

  const str = String(value).trim();
  // Try "price x size" pattern
  const match = str.match(/^([\d,.]+)\s*[xX×]\s*([\d,.]+)$/);
  if (match) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    const size = parseInt(match[2].replace(/,/g, ''), 10);
    return {
      price: Number.isFinite(price) ? price : null,
      size: Number.isFinite(size) ? size : null
    };
  }

  // Single number
  const num = parseFloat(str.replace(/,/g, ''));
  return {
    price: Number.isFinite(num) ? num : null,
    size: null
  };
}

/**
 * Parse a date value into ISO string.
 * Accepts: Date objects, ISO strings, Unix timestamps (seconds), epoch ms.
 * Returns null for invalid dates.
 */
export function parseDate(value) {
  if (isMissing(value)) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    // Distinguish seconds vs milliseconds: if < 1e12 it's likely seconds
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

/**
 * Returns the value if it's valid (not missing), otherwise null.
 * Useful for conditional field assignment.
 */
export function validOrNull(value) {
  return isMissing(value) ? null : value;
}

/**
 * Check if a value is a valid non-missing number suitable for a financial field.
 * For fields where 0 is legitimately missing (e.g., price, marketCap), use isValidFinancialValue.
 */
export function isValidValue(value) {
  if (isMissing(value)) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

/**
 * Safe division: returns null if divisor is 0 or inputs are invalid.
 * Prevents Infinity and NaN.
 */
export function safeDivide(numerator, denominator) {
  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}
