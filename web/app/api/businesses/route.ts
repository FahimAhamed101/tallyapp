import { NextResponse, type NextRequest } from 'next/server';
import Business from '@/lib/models/Business';
import { badRequest, conflict, handler, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { businessView, listBusinesses } from '@/lib/business';
import { toBn } from '@/lib/bengali';
import { businessCreateSchema, formatZodError } from '@/lib/validators';

/**
 * GET  /api/businesses   -> the মাল্টি ব্যবসা sheet: every book, with counts
 * POST /api/businesses   -> the '+ নতুন ব্যবসা' button
 *
 * The list is what feeds the switcher, so it carries the live customer and
 * supplier tallies rather than making the client fetch each book to count.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const items = await listBusinesses(user);
  return NextResponse.json({
    items,
    total: items.length,
    max: Business.MAX,
    // Bengali numerals, like every other counter in the app — the sheet renders
    // this string verbatim, so "(1/5)" would be the one Latin-digit label left.
    label: `ব্যবসা সমূহ (${toBn(items.length)}/${toBn(Business.MAX)})`,
  });
});

export const POST = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);

  const body = await readJson(req);
  const parsed = businessCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  // The cap is enforced here rather than in the UI: the sheet hides the add
  // button at five, but the server is what actually guarantees it.
  const existing = await Business.countDocuments({ owner: user._id });
  if (existing >= Business.MAX) {
    throw conflict(`সর্বোচ্চ ${toBn(Business.MAX)}টি ব্যবসা যোগ করা যাবে`);
  }

  const doc = await Business.create({
    owner: user._id,
    name: parsed.data.name,
    category: parsed.data.category || 'মুদি বা জেনারেল স্টোর',
    isPersonal: parsed.data.isPersonal ?? false,
    // Only the very first book is primary; later ones are plain additions.
    isPrimary: existing === 0,
  });

  return NextResponse.json(
    { business: businessView(doc, { customer: 0, supplier: 0, receivable: 0 }) },
    { status: 201 },
  );
});
