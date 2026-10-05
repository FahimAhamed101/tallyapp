import crypto from 'node:crypto';
import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

/**
 * A shopkeeper account — the Next.js port of backend/src/models/User.js.
 *
 * Login is by phone number; each user owns an entirely separate set of
 * customers, transactions, cashbox entries, profile and wallet.
 *
 * Passwords use scrypt with a per-user random salt. This is deliberately NOT
 * bcrypt: the accounts already seeded in the shared Atlas `tally` database were
 * hashed with scrypt, so switching algorithms here would lock every existing
 * user (and the Android app's test account) out.
 *
 * Session tokens are random 32-byte hex strings; only their SHA-256 is stored,
 * so a database leak does not hand over live sessions.
 *
 * Typing note: the document type is *derived* from the schema via
 * `InferSchemaType` rather than declared by hand. A hand-written interface has
 * to match mongoose's `SchemaDefinitionProperty` expectations exactly, and any
 * drift produces a wall of unrelated-looking errors on every path.
 */

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordSalt: { type: String, required: true },
    passwordHash: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true, index: true, sparse: true, default: null },
    photoUrl: { type: String, default: '' },
    /**
     * Panel access level. Defaults to 'user' so every account created by the
     * Android app stays a plain shopkeeper; promotion to 'admin' is a manual,
     * server-side operation.
     */
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    disabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    sessions: [
      {
        _id: false,
        hash: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export type UserRole = 'user' | 'admin';
export type UserDoc = HydratedDocument<InferSchemaType<typeof UserSchema>>;

export interface PublicUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  photoUrl: string;
  role: UserRole;
  createdAt: Date;
}

// ---- statics, written as plain functions ----------------------------------
// Declaring them standalone (instead of as `this`-bound methods) keeps the
// types honest without fighting mongoose's `this` inference.

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

/**
 * Canonical form is `+8801XXXXXXXXX`.
 *
 *   "01706617723"      -> "+8801706617723"
 *   "+8801706617723"   -> "+8801706617723"
 *   "৮৮০ ১৭০৬ ৬১৭৭২৩" -> "+8801706617723"
 *   "+14155552671"     -> "+14155552671"   (non-BD numbers are preserved)
 */
function normalizePhone(input: unknown): string {
  const s = String(input ?? '').replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d]);
  const hadPlus = s.trim().startsWith('+');
  let digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);

  const stripTrunkZero = (d: string) => (d.startsWith('0') ? d.slice(1) : d);

  if (digits.startsWith('880')) return `+880${stripTrunkZero(digits.slice(3))}`;
  if (digits.startsWith('88') && digits.length > 10) {
    return `+880${stripTrunkZero(digits.slice(2))}`;
  }

  // A bare local number (10-11 digits, optionally with the trunk 0).
  if (!hadPlus && digits.length <= 11) return `+880${stripTrunkZero(digits)}`;

  return `+${digits}`;
}

/** True when the string looks like a usable phone number. */
function isValidPhone(input: unknown): boolean {
  return /^\+\d{8,15}$/.test(normalizePhone(input));
}

const SCRYPT_KEYLEN = 64;

function hashPassword(password: unknown, salt: string): string {
  return crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
}

function setPassword(user: UserDoc, password: unknown): void {
  user.passwordSalt = crypto.randomBytes(16).toString('hex');
  user.passwordHash = hashPassword(password, user.passwordSalt);
}

/** Constant-time password check. */
function verifyPassword(user: UserDoc | null | undefined, password: unknown): boolean {
  if (!user || !user.passwordSalt || !user.passwordHash) return false;
  const attempt = Buffer.from(hashPassword(password, user.passwordSalt), 'hex');
  const stored = Buffer.from(user.passwordHash, 'hex');
  if (attempt.length !== stored.length) return false;
  return crypto.timingSafeEqual(attempt, stored);
}

function makeToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: unknown): string {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** Issues a token, keeps at most 5 live sessions, and returns the raw token. */
function issueToken(user: UserDoc): string {
  const token = makeToken();
  // `set()` rather than direct assignment: the inferred type for `sessions` is
  // a mongoose DocumentArray, which a plain array literal does not satisfy.
  const kept = (user.sessions || []).slice(-4).map((s) => ({
    hash: s.hash,
    createdAt: s.createdAt,
  }));
  user.set('sessions', [...kept, { hash: hashToken(token), createdAt: new Date() }]);
  user.lastLoginAt = new Date();
  return token;
}

function revokeToken(user: UserDoc, tokenHash: string): void {
  user.set(
    'sessions',
    (user.sessions || []).filter((s) => s.hash !== tokenHash),
  );
}

/** The JSON shape the client sees. Never includes any hash or salt. */
function publicView(user: UserDoc): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    email: user.email || '',
    photoUrl: user.photoUrl || '',
    role: (user.role as UserRole) || 'user',
    createdAt: user.createdAt,
  };
}

/** The statics the rest of the app calls through the model. */
export interface UserStatics {
  normalizePhone: typeof normalizePhone;
  isValidPhone: typeof isValidPhone;
  hashPassword: typeof hashPassword;
  setPassword: typeof setPassword;
  verifyPassword: typeof verifyPassword;
  makeToken: typeof makeToken;
  hashToken: typeof hashToken;
  issueToken: typeof issueToken;
  revokeToken: typeof revokeToken;
  publicView: typeof publicView;
}

const statics = UserSchema.statics as unknown as UserStatics;
statics.normalizePhone = normalizePhone;
statics.isValidPhone = isValidPhone;
statics.hashPassword = hashPassword;
statics.setPassword = setPassword;
statics.verifyPassword = verifyPassword;
statics.makeToken = makeToken;
statics.hashToken = hashToken;
statics.issueToken = issueToken;
statics.revokeToken = revokeToken;
statics.publicView = publicView;

export type UserModel = Model<InferSchemaType<typeof UserSchema>> & UserStatics;

// `mongoose.models.User` guard keeps hot reloads from redefining the model.
export const User = (mongoose.models.User as UserModel) ||
  (model('User', UserSchema) as unknown as UserModel);

export default User;
