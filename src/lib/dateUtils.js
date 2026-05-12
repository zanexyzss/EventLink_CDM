import { format as fnsFormat, isPast as fnsIsPast, isValid } from 'date-fns';

/**
 * Safely parse a date value from the database.
 * sql.js returns dates like "2026-06-15 09:00:00" (no T separator),
 * which some browsers can't parse natively. This normalizes them.
 */
export function safeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  // Normalize "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS"
  const str = String(value).trim().replace(' ', 'T');
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Safe format — returns fallback string if date is invalid.
 */
export function safeFormat(value, pattern, fallback = '—') {
  const d = safeDate(value);
  if (!d || !isValid(d)) return fallback;
  try {
    return fnsFormat(d, pattern);
  } catch {
    return fallback;
  }
}

/**
 * Safe isPast check — returns false if date is invalid.
 */
export function safeIsPast(value) {
  const d = safeDate(value);
  if (!d) return false;
  return fnsIsPast(d);
}
