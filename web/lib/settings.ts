import crypto from 'node:crypto';
import { type HydratedDocument } from 'mongoose';
import Profile, { type ProfileDoc } from './models/Profile';
import { type UserDoc } from './models/User';
import { getProfile } from './app-data';
import { badRequest, notFound } from './api-helpers';
import { toBn } from './bengali';

/**
 * সেটিংস — the server side of the drawer's সেটিংস row.
 *
 * The reference screen has three sections, and each one needs a different kind
 * of answer from the server:
 *
 *   সাধারণ সেটিংস   two real preferences (টাকার অঙ্কে দশমিক, নোটিফিকেশন সাউন্ড)
 *                   that persist on the account's Profile.
 *   প্রোফাইল সেটিংস  the account's own mobile number — the row is a real,
 *                   working change-number flow, not the reference screenshot's
 *                   greyed-out "turn your internet on" state.
 *   অ্যাপ সিকিউরিটি   an optional 4-6 digit PIN, stored as a salted scrypt hash.
 *
 * Everything the screen renders that *depends on state* is computed here: the
 * decimal example line, the PIN row's wording, the account's number. Only the
 * static section headings are hardcoded in the composable, so a rule change
 * (a different PIN length, say) cannot leave the screen describing the old one.
 */

/**
 * `InferSchemaType` is the *plain* shape of a profile, which has no `.get`,
 * `.set` or `.save`. Everything below works on the hydrated document mongoose
 * actually hands back, so the alias is declared once here rather than repeated.
 */
type ProfileDocument = HydratedDocument<ProfileDoc>;

const SCRYPT_KEYLEN = 64;
const PIN_MIN = 4;
const PIN_MAX = 6;

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

/** 0-9 -> ০-৯ on an arbitrary string, so a phone keeps its `+`. */
const bnDigits = (s: string) => s.replace(/[0-9]/g, (d) => toBn(d));

/** "১,২৫০.৫০" with `decimals`, or "১,২৫০" without. */
function grouped(n: number, decimals: boolean): string {
  const fixed = decimals ? Math.abs(n).toFixed(2) : String(Math.round(Math.abs(n)));
  const [whole, frac] = fixed.split('.');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toBn(frac ? `${groupedWhole}.${frac}` : groupedWhole);
}

/**
 * Reads a JSON boolean, tolerating the string spellings a hand-written client
 * might send. The Android app sends real booleans; this exists so a `"false"`
 * from curl does not silently mean `true`.
 */
function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'হ্যাঁ'].includes(t)) return true;
    if (['false', '0', 'no', 'off', 'না'].includes(t)) return false;
  }
  return fallback;
}

// ---- the PIN --------------------------------------------------------------

function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
}

/**
 * Sets (or changes) the PIN. The caller's digits are normalised first so a
 * shopkeeper typing ১২৩৪ on a Bengali keyboard gets the same PIN as one typing
 * 1234 — the same tolerance `normalizePhone` and `parseAmount` already give.
 */
function setPin(doc: ProfileDocument, raw: string): void {
  const digits = raw.replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d]).trim();
  if (!new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(digits)) {
    throw badRequest(`PIN হতে হবে ${toBn(PIN_MIN)} থেকে ${toBn(PIN_MAX)} সংখ্যার`);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  doc.set('pinSalt', salt);
  doc.set('pinHash', hashPin(digits, salt));
  doc.set('pinSetAt', new Date());
}

function clearPin(doc: ProfileDocument): void {
  doc.set('pinSalt', '');
  doc.set('pinHash', '');
  doc.set('pinSetAt', null);
}

/** True when a PIN has been set. The hash itself is never compared here. */
function pinIsSet(doc: ProfileDocument): boolean {
  const hash = String(doc.get('pinHash') || '');
  return hash.length > 0;
}

/**
 * Constant-time check, for the day a lock screen needs it. Not used by the
 * settings screen — that only ever reports *whether* a PIN exists — but it is
 * the reason the salt/hash pair is stored rather than a flag.
 */
export function verifyPin(doc: ProfileDocument, raw: unknown): boolean {
  const stored = String(doc.get('pinHash') || '');
  const salt = String(doc.get('pinSalt') || '');
  if (!stored || !salt) return false;
  const digits = String(raw ?? '').replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d]).trim();
  const attempt = Buffer.from(hashPin(digits, salt), 'hex');
  const expected = Buffer.from(stored, 'hex');
  if (attempt.length !== expected.length) return false;
  return crypto.timingSafeEqual(attempt, expected);
}

// ---- the profile document -------------------------------------------------

/**
 * The account's Profile, created on demand.
 *
 * `getProfile` is the same self-healing getter the toolbar uses, so calling it
 * and re-reading is the established idiom (see `patchProfile`) rather than a
 * second copy of the provisioning logic.
 */
async function profileDocFor(user: UserDoc): Promise<ProfileDocument> {
  let doc = await Profile.findOne({ owner: user._id });
  if (!doc) {
    await getProfile(user);
    doc = await Profile.findOne({ owner: user._id });
  }
  if (!doc) throw notFound('প্রোফাইল পাওয়া যায়নি');
  return doc;
}

// ---- the view -------------------------------------------------------------

export interface SettingsView {
  /** টাকার অঙ্কে দশমিক. */
  decimalAmount: boolean;
  /** নোটিফিকেশন সাউন্ড. */
  notificationSound: boolean;
  /** Whether an অ্যাপ সিকিউরিটি PIN exists. Never the PIN. */
  pinSet: boolean;

  /** "উদাহরণঃ ১২,০০০.০০" — flips with the toggle, as the reference shows. */
  decimalExample: string;
  /** "টালিখাতা নোটিফিকেশনে সাউন্ড এলার্ট" */
  notificationSubtitle: string;

  /** "মোবাইল নম্বর পরিবর্তন" */
  phoneLabel: string;
  /** "বর্তমান নম্বর +৮৮০১৭০৬৬১৭৭২৩" */
  phoneSubtitle: string;

  /** "PIN সেট করুন" / "PIN পরিবর্তন করুন" */
  pinLabel: string;
  /** "PIN সেট করা আছে" / "PIN সেট করা হয়নি" */
  pinSubtitle: string;

  /** The server's rule, so the client's hint cannot drift from the validator. */
  pinMin: number;
  pinMax: number;
}

export function settingsView(doc: ProfileDocument, user: UserDoc): SettingsView {
  const decimalAmount = asBool(doc.get('settings.decimalAmount'), true);
  const notificationSound = asBool(doc.get('settings.notificationSound'), true);
  const pinSet = pinIsSet(doc);

  // `Profile.phone` is kept in step with `User.phone` by PATCH /api/profile, but
  // the account record is the authority: a profile provisioned before the phone
  // was set can be blank while the login credential is not.
  const phone = String(doc.get('phone') || user.phone || '');

  return {
    decimalAmount,
    notificationSound,
    pinSet,
    decimalExample: `উদাহরণঃ ${grouped(12000, decimalAmount)}`,
    notificationSubtitle: 'টালিখাতা নোটিফিকেশনে সাউন্ড এলার্ট',
    phoneLabel: 'মোবাইল নম্বর পরিবর্তন',
    phoneSubtitle: `বর্তমান নম্বর ${bnDigits(phone)}`,
    pinLabel: pinSet ? 'PIN পরিবর্তন করুন' : 'PIN সেট করুন',
    pinSubtitle: pinSet ? 'PIN সেট করা আছে' : 'PIN সেট করা হয়নি',
    pinMin: PIN_MIN,
    pinMax: PIN_MAX,
  };
}

// ---- the API --------------------------------------------------------------

export async function getSettings(user: UserDoc): Promise<SettingsView> {
  const doc = await profileDocFor(user);
  return settingsView(doc, user);
}

/**
 * Applies only the keys that were sent — the same contract every other PATCH in
 * this app follows. A client that flips one toggle therefore cannot clobber the
 * other, which matters because the two are independent and the Android client
 * sends one at a time.
 */
export async function updateSettings(
  user: UserDoc,
  body: Record<string, unknown>,
): Promise<SettingsView> {
  const doc = await profileDocFor(user);

  if (body.decimalAmount !== undefined) {
    doc.set('settings.decimalAmount', asBool(body.decimalAmount, true));
  }
  if (body.notificationSound !== undefined) {
    doc.set('settings.notificationSound', asBool(body.notificationSound, true));
  }

  // A non-empty string sets or changes the PIN; an explicit empty string
  // removes it. The distinction is deliberate: `pin: ''` is how the app's
  // "PIN সরান" action asks for removal, so a missing key must NOT clear it.
  if (body.pin !== undefined) {
    const raw = String(body.pin ?? '').trim();
    if (raw === '') clearPin(doc);
    else setPin(doc, raw);
  }

  await doc.save();
  return settingsView(doc, user);
}

export { PIN_MIN, PIN_MAX, clearPin, setPin, pinIsSet };
