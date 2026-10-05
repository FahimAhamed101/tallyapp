/**
 * Bengali formatting helpers — a direct port of backend/src/lib/bengali.js.
 *
 * The Android app renders Bengali text but does no locale formatting of its
 * own, so the server sends ready-to-display strings alongside the raw numbers.
 * Keeping these byte-identical means the port is a drop-in replacement.
 */

const DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

/** 0-9 -> ০-৯ */
export function toBn(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => DIGITS[Number(d)]);
}

/** 1250.5 -> "১,২৫০.৫০" */
export function amount(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const fixed = Math.abs(n).toFixed(2);
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toBn(`${grouped}.${frac}`);
}

/** "০৪ অক্টোবর, ২৬" — the date pill format used across the app. */
export function dateBn(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${toBn(day)} ${MONTHS[d.getMonth()]}, ${toBn(year)}`;
}

/** "০৫ অক্টোবর" — the short date pill on the ledger form. */
export function dateShortBn(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  return `${toBn(day)} ${MONTHS[d.getMonth()]}`;
}

/** "৮০ মিনিট আগে" / "২ ঘন্টা আগে" / "গতকাল" / "৩ দিন আগে" */
export function relativeBn(date: Date | string): string {
  const then = new Date(date).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'এখন';
  if (mins < 60) return `${toBn(mins)} মিনিট আগে`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${toBn(hours)} ঘন্টা আগে`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'গতকাল';
  if (days < 30) return `${toBn(days)} দিন আগে`;
  const months = Math.round(days / 30);
  return `${toBn(months)} মাস আগে`;
}

/** 0 -> "০.০০", used by every zero-balance row in the app. */
export function zeroAmount(): string {
  return amount(0);
}

/** Money object shape the Android client expects: { raw, display }. */
export function money(n: number | null | undefined): { raw: number; display: string } {
  return { raw: Number(n || 0), display: amount(n) };
}

/** "টালিখাতা" — initials for an avatar badge, matching the customer rule. */
export function initialsFor(name: string | null | undefined): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  // Latin initials read better uppercase ("vbv" -> "VB"); Bengali has no case.
  return /^[\x00-\x7F]+$/.test(raw) ? raw.toUpperCase() : raw;
}
