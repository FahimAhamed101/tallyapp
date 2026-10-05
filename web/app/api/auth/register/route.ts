import { NextResponse, type NextRequest } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { badRequest, conflict, handler, readJson } from '@/lib/api-helpers';
import { getProfile, getWallet } from '@/lib/app-data';
import { formatZodError, registerSchema } from '@/lib/validators';

/**
 * POST /api/auth/register  { name, phone, password }
 *
 * Creates the account plus its profile and wallet, and returns a bearer token
 * so the Android app can go straight to the home tab.
 *
 * Note for anyone editing this: the Express version had a destructuring bug
 * here (`name` instead of `cleanName`) that made every registration fail with
 * a Mongoose `Path 'name' is required`. Zod now guarantees the field exists.
 */

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest) => {
  await dbConnect();

  const body = await readJson(req);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const cleanName = parsed.data.name;
  const cleanPhone = User.normalizePhone(parsed.data.phone);
  if (!User.isValidPhone(cleanPhone)) throw badRequest('সঠিক মোবাইল নম্বর দিন');

  const existing = await User.findOne({ phone: cleanPhone });
  if (existing) throw conflict('এই নম্বর দিয়ে আগেই অ্যাকাউন্ট আছে, লগইন করুন');

  const user = new User({ name: cleanName, phone: cleanPhone, role: 'user' });
  User.setPassword(user, parsed.data.password);
  const token = User.issueToken(user);
  await user.save();

  // Every account gets its own profile + wallet so the UI is never empty.
  await Promise.all([getProfile(user), getWallet(user._id)]);

  return NextResponse.json(
    { token, user: User.publicView(user) },
    { status: 201 },
  );
});
