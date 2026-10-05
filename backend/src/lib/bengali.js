/**
 * Bengali formatting helpers.
 *
 * The Android app renders Bengali text but does no locale formatting of its
 * own, so the server sends ready-to-display strings alongside the raw numbers.
 */

const DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

const MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

/** 0-9 -> ০-৯ */
function toBn(value) {
  return String(value).replace(/[0-9]/g, (d) => DIGITS[Number(d)]);
}

/** 1250.5 -> "১,২৫০.৫০" */
function amount(value) {
  const n = Number(value || 0);
  const fixed = Math.abs(n).toFixed(2);
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toBn(`${grouped}.${frac}`);
}

/** "০৪ অক্টোবর, ২৬" - the date pill format used across the app. */
function dateBn(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${toBn(day)} ${MONTHS[d.getMonth()]}, ${toBn(year)}`;
}

/** "০৫ অক্টোবর" - the short date pill on the ledger form. */
function dateShortBn(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  return `${toBn(day)} ${MONTHS[d.getMonth()]}`;
}

/** "৮০ মিনিট আগে" / "২ ঘন্টা আগে" / "গতকাল" / "৩ দিন আগে" */
function relativeBn(date) {
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
function zeroAmount() {
  return amount(0);
}

module.exports = { toBn, amount, dateBn, dateShortBn, relativeBn, zeroAmount, MONTHS };
