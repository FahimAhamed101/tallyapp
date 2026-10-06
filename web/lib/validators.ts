import { z } from 'zod';

/**
 * Request validators — the Next.js port's contract layer.
 *
 * The Android app already sends well-formed JSON, so these are mostly a safety
 * net: they turn a malformed body into a clean 422 with Bengali field messages
 * instead of a Mongoose cast error. Every message stays Bengali so it can be
 * shown to the shopkeeper verbatim.
 */

/** Turns a ZodError into the `details` array the API envelope carries. */
export function formatZodError(err: z.ZodError): { field: string; message: string }[] {
  return err.errors.map((issue) => ({
    field: issue.path.join('.') || '_',
    message: issue.message,
  }));
}

/**
 * Normalises a Bengali-digit-tolerant number: accepts 12, "১২", "৳ 1,250.50".
 * Returns `NaN` for anything unparseable so the caller's schema reports it.
 */
function normalizeNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const bn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  const normalized = String(v).replace(/[০-৯]/g, (d) => bn[d]).replace(/[৳,\s]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Bengali-digit-tolerant amount. Must be strictly positive. */
const amountField = z.preprocess(normalizeNumber, z.number().positive('সঠিক পরিমাণ দিন'));

/**
 * Same tolerance, but 0 is allowed.
 *
 * Needed for prices and counts, where zero is a real answer rather than a
 * missing one: a shopkeeper may not know a purchase price yet, and an item may
 * legitimately have no opening stock.
 */
const nonNegativeField = z.preprocess(normalizeNumber, z.number().min(0, 'সঠিক পরিমাণ দিন'));

/**
 * Booleans need an explicit preprocess: `boolField` maps the *string*
 * "false" to `true`, because JS `Boolean("false") === true`. The Android app
 * sends real JSON booleans, but a form post or curl may not.
 */
const boolField = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined || v === '') return false;
  const s = String(v).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  return Boolean(v);
}, z.boolean());

const phoneField = z
  .string({ required_error: 'মোবাইল নম্বর দিন' })
  .trim()
  .min(1, 'মোবাইল নম্বর দিন');

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => (v ? new Date(v) : new Date()));

// ---- auth -----------------------------------------------------------------

export const registerSchema = z.object({
  name: z.string({ required_error: 'নাম আবশ্যক' }).trim().min(1, 'নাম আবশ্যক').max(60, 'নাম অনেক বড়'),
  phone: phoneField,
  password: z
    .string({ required_error: 'পাসওয়ার্ড দিন' })
    .min(6, 'পাসওয়ার্ড কমপক্ষে 6 অক্ষরের হতে হবে'),
});

export const loginSchema = z
  .object({
    phone: z.string().optional(),
    email: z.string().optional(),
    identifier: z.string().optional(),
    password: z.string().optional(),
  })
  .refine((data) => Boolean(data.phone?.trim() || data.email?.trim() || data.identifier?.trim()), {
    message: 'মোবাইল নম্বর বা ইমেইল দিন',
    path: ['phone'],
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে 6 অক্ষরের হতে হবে'),
});

// ---- customers ------------------------------------------------------------

export const customerCreateSchema = z.object({
  name: z.string({ required_error: 'নাম আবশ্যক' }).trim().min(1, 'নাম আবশ্যক'),
  phone: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => !v || /^[+0-9০-৯\s-]{6,20}$/.test(v), 'মোবাইল নম্বর সঠিক নয়'),
  type: z.enum(['customer', 'supplier']).optional().default('customer'),
  note: z.string().optional().default(''),
  photoUrl: z.string().optional().default(''),
  photoPublicId: z.string().optional().default(''),
});

export const customerUpdateSchema = z.object({
  name: z.string().trim().min(1, 'নাম আবশ্যক').optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => v === undefined || !v || /^[+0-9০-৯\s-]{6,20}$/.test(v), 'মোবাইল নম্বর সঠিক নয়'),
  type: z.enum(['customer', 'supplier']).optional(),
  note: z.string().optional(),
  photoUrl: z.string().optional(),
  photoPublicId: z.string().optional(),
});

export const transactionCreateSchema = z
  .object({
    box: z.enum(['gave', 'got']).optional(),
    kind: z
      .enum(['sale', 'purchase', 'payment_received', 'payment_made', 'refund'])
      .optional(),
    amount: amountField,
    description: z.string().optional().default(''),
    hasPhoto: boolField.optional().default(false),
    date: optionalDate,
  })
  .refine((v) => Boolean(v.box || v.kind), {
    message: 'লেনদেনের ধরন সঠিক নয়',
    path: ['kind'],
  });

// ---- cashbox --------------------------------------------------------------

export const cashboxCreateSchema = z.object({
  kind: z.enum(['cash_sale', 'cash_purchase', 'expense', 'owner_in', 'owner_out'], {
    required_error: 'খরচের ধরন সঠিক নয়',
    invalid_type_error: 'খরচের ধরন সঠিক নয়',
  }),
  amount: amountField,
  description: z.string().optional().default(''),
  category: z.string().optional().default(''),
  hasPhoto: boolField.optional().default(false),
  date: optionalDate,
});

// ---- businesses -----------------------------------------------------------

export const businessCreateSchema = z.object({
  name: z
    .string({ required_error: 'ব্যবসার নাম দিন' })
    .trim()
    .min(1, 'ব্যবসার নাম দিন')
    .max(60, 'নাম অনেক বড়'),
  category: z.string().optional(),
  isPersonal: z.boolean().optional(),
});

export const businessUpdateSchema = z.object({
  name: z.string().trim().min(1, 'ব্যবসার নাম দিন').max(60, 'নাম অনেক বড়').optional(),
  /** Promote this book to the account default. */
  isPrimary: boolField.optional(),
});

// ---- stock (স্টক হিসাব) -----------------------------------------------------

export const stockItemCreateSchema = z.object({
  name: z
    .string({ required_error: 'পণ্যের নাম দিন' })
    .trim()
    .min(1, 'পণ্যের নাম দিন')
    .max(80, 'নাম অনেক বড়'),
  /** পিস / কেজি / লিটার — free text, as in the reference app. */
  unit: z.string().trim().max(20, 'একক অনেক বড়').optional(),
  purchasePrice: nonNegativeField.optional(),
  salePrice: nonNegativeField.optional(),
  openingStock: nonNegativeField.optional(),
  /** 0 means "do not warn about low stock". */
  lowStockThreshold: nonNegativeField.optional(),
  note: z.string().trim().max(200, 'বিবরণ অনেক বড়').optional(),
  photoUrl: z.string().trim().optional(),
  photoPublicId: z.string().trim().optional(),
});

/** Every field optional — PATCH sends only what changed. */
export const stockItemUpdateSchema = stockItemCreateSchema.partial();

export const stockMovementCreateSchema = z.object({
  direction: z.enum(['in', 'out'], {
    required_error: 'স্টক ইন না আউট তা দিন',
    invalid_type_error: 'স্টক ইন না আউট তা দিন',
  }),
  /** A movement of zero is meaningless, so this is strictly positive. */
  quantity: amountField,
  unitCost: nonNegativeField.optional(),
  note: z.string().trim().max(200, 'বিবরণ অনেক বড়').optional(),
  date: optionalDate,
});

// ---- uploads --------------------------------------------------------------

export const uploadSchema = z.object({
  data: z.string({ required_error: 'ছবির ডেটা পাওয়া যায়নি' }).min(1, 'ছবির ডেটা পাওয়া যায়নি'),
  mime: z.string().optional(),
  folder: z.string().optional(),
  publicId: z.string().optional(),
  tags: z.string().optional(),
});

// ---- profile --------------------------------------------------------------

export const profilePatchSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  initials: z.string().optional(),
  photoUrl: z.string().optional(),
  goldPlanName: z.string().optional(),
  goldTrialDays: z.coerce.number().optional(),
  inboxUnread: z.coerce.number().optional(),
  smsRemaining: z.coerce.number().optional(),
  appVersion: z.string().optional(),
});

// ---- admin ----------------------------------------------------------------

/** Admin-only account edits (the panel's user screen). */
export const adminUserUpdateSchema = z.object({
  name: z.string().trim().min(1, 'নাম আবশ্যক').optional(),
  phone: z.string().trim().min(1, 'মোবাইল নম্বর দিন').optional(),
  role: z.enum(['user', 'admin']).optional(),
  disabled: boolField.optional(),
  photoUrl: z.string().optional(),
});

/** Admin-only customer edits — same fields, no owner scoping. */
export const adminCustomerUpdateSchema = customerUpdateSchema;

/** Admin-only ledger entry edits. */
export const adminTransactionUpdateSchema = z.object({
  kind: z.enum(['sale', 'purchase', 'payment_received', 'payment_made', 'refund']).optional(),
  amount: amountField.optional(),
  description: z.string().optional(),
  hasPhoto: boolField.optional(),
  date: z.union([z.string(), z.date()]).optional(),
});

/** Admin-only cashbox entry edits. */
export const adminCashboxUpdateSchema = z.object({
  kind: z
    .enum(['cash_sale', 'cash_purchase', 'expense', 'owner_in', 'owner_out'])
    .optional(),
  amount: amountField.optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  hasPhoto: boolField.optional(),
  date: z.union([z.string(), z.date()]).optional(),
});

// ---- ব্যবসার নোট ------------------------------------------------------------

const noteText = z.string().trim().min(1, 'নোট লিখুন').max(500, 'নোটটি অনেক বড়');

/** New checklist line. */
export const noteCreateSchema = z.object({
  text: noteText,
  done: boolField.optional(),
});

/** Edit or tick a line; only the keys sent are touched. */
export const noteUpdateSchema = z.object({
  text: noteText.optional(),
  done: boolField.optional(),
});
