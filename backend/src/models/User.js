const crypto = require('crypto');
const { Schema, model } = require('mongoose');

/**
 * A shopkeeper account. Login is by phone number; each user owns an entirely
 * separate set of customers, transactions, cashbox entries, profile and wallet.
 *
 * Passwords use scrypt with a per-user random salt — no bcrypt dependency.
 * Session tokens are random 32-byte hex strings; only their SHA-256 is stored,
 * so a database leak does not hand over live sessions.
 */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordSalt: { type: String, required: true },
    passwordHash: { type: String, required: true },
    photoUrl: { type: String, default: '' },
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

const BENGALI_DIGITS = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };

/**
 * Canonical form is `+8801XXXXXXXXX`.
 *
 *   "01706617723"      -> "+8801706617723"
 *   "+8801706617723"   -> "+8801706617723"
 *   "৮৮০ ১৭০৬ ৬১৭৭২৩" -> "+8801706617723"
 *   "+14155552671"     -> "+14155552671"   (non-BD numbers are preserved)
 */
UserSchema.statics.normalizePhone = function normalizePhone(input) {
  let s = String(input == null ? '' : input).replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d]);
  const hadPlus = s.trim().startsWith('+');
  let digits = s.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);

  const stripTrunkZero = (d) => (d.startsWith('0') ? d.slice(1) : d);

  if (digits.startsWith('880')) return `+880${stripTrunkZero(digits.slice(3))}`;
  if (digits.startsWith('88') && digits.length > 10) return `+880${stripTrunkZero(digits.slice(2))}`;

  // A bare local number (10–11 digits, optionally with the trunk 0).
  if (!hadPlus && digits.length <= 11) return `+880${stripTrunkZero(digits)}`;

  return `+${digits}`;
};

/** True when the string looks like a usable phone number. */
UserSchema.statics.isValidPhone = function isValidPhone(input) {
  const normalized = UserSchema.statics.normalizePhone(input);
  return /^\+\d{8,15}$/.test(normalized);
};

const SCRYPT_KEYLEN = 64;

UserSchema.statics.hashPassword = function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
};

UserSchema.statics.setPassword = function setPassword(user, password) {
  user.passwordSalt = crypto.randomBytes(16).toString('hex');
  user.passwordHash = UserSchema.statics.hashPassword(password, user.passwordSalt);
};

/** Constant-time password check. */
UserSchema.statics.verifyPassword = function verifyPassword(user, password) {
  if (!user || !user.passwordSalt || !user.passwordHash) return false;
  const attempt = Buffer.from(UserSchema.statics.hashPassword(password, user.passwordSalt), 'hex');
  const stored = Buffer.from(user.passwordHash, 'hex');
  if (attempt.length !== stored.length) return false;
  return crypto.timingSafeEqual(attempt, stored);
};

UserSchema.statics.makeToken = function makeToken() {
  return crypto.randomBytes(32).toString('hex');
};

UserSchema.statics.hashToken = function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

/** Issues a token, keeps at most 5 live sessions, and returns the raw token. */
UserSchema.statics.issueToken = function issueToken(user) {
  const token = UserSchema.statics.makeToken();
  user.sessions = (user.sessions || []).slice(-4);
  user.sessions.push({ hash: UserSchema.statics.hashToken(token), createdAt: new Date() });
  user.lastLoginAt = new Date();
  return token;
};

UserSchema.statics.revokeToken = function revokeToken(user, tokenHash) {
  user.sessions = (user.sessions || []).filter((s) => s.hash !== tokenHash);
};

/** The JSON shape the client sees. Never includes any hash or salt. */
UserSchema.statics.publicView = function publicView(user) {
  return {
    id: String(user._id),
    name: user.name,
    phone: user.phone,
    photoUrl: user.photoUrl || '',
    createdAt: user.createdAt,
  };
};

module.exports = model('User', UserSchema);
