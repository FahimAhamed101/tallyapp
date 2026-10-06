import { NextResponse, type NextRequest } from 'next/server';
import Customer from '@/lib/models/Customer';
import { badRequest, handler, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope, scopeFilter } from '@/lib/business';
import { balancesFor, customerView } from '@/lib/ledger';
import { escapeRegex } from '@/lib/app-data';
import { customerCreateSchema, formatZodError } from '@/lib/validators';

/**
 * GET  /api/customers?q=&type=   -> home list, for the active business
 * POST /api/customers            -> নতুন কাস্টমার/সাপ্লায়ার form
 *
 * Scoped to one business: the same shopkeeper can keep separate books, and a
 * customer in one is invisible from another.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const q = req.nextUrl.searchParams.get('q');
  const type = req.nextUrl.searchParams.get('type');

  const filter: Record<string, unknown> = scopeFilter(scope);
  if (type === 'customer' || type === 'supplier') filter.type = type;
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');

  const customers = await Customer.find(filter).sort({ createdAt: 1, _id: 1 });
  const balances = await balancesFor(user._id, customers.map((c) => c._id));

  return NextResponse.json({
    items: customers.map((c) => customerView(c, balances.get(String(c._id)))),
  });
});

export const POST = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { business } = await resolveScope(req, user);

  const body = await readJson(req);
  const parsed = customerCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }
  const { name, phone, type, note, photoUrl, photoPublicId } = parsed.data;

  const [bg, fg] = Customer.pickAvatar(name);
  const doc = await Customer.create({
    owner: user._id,
    business: business._id,
    name,
    phone,
    type,
    note: String(note || '').trim(),
    initials: Customer.makeInitials(name),
    avatarColor: bg,
    avatarTextColor: fg,
    photoUrl: String(photoUrl || '').trim(),
    photoPublicId: String(photoPublicId || '').trim(),
    lastActivityAt: new Date(),
  });

  return NextResponse.json({ customer: customerView(doc, null) }, { status: 201 });
});
