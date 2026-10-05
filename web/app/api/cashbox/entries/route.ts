import { NextResponse, type NextRequest } from 'next/server';
import CashboxEntry from '@/lib/models/CashboxEntry';
import { badRequest, handler, parseAmount, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { cashboxDashboard, cashboxEntryView } from '@/lib/app-data';
import { cashboxCreateSchema, formatZodError } from '@/lib/validators';

/**
 * GET  /api/cashbox/entries?kind=&limit=
 * POST /api/cashbox/entries -> ক্যাশ বেচা / খরচ / মালিক দিল / মালিক নিল forms
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);

  const kind = req.nextUrl.searchParams.get('kind');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 100, 500);

  const filter: Record<string, unknown> = { owner: user._id };
  if (kind) filter.kind = kind;

  const entries = await CashboxEntry.find(filter).sort({ date: -1 }).limit(limit);
  return NextResponse.json({ items: entries.map(cashboxEntryView) });
});

export const POST = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);

  const body = await readJson(req);
  const parsed = cashboxCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const amt = parseAmount(body.amount ?? parsed.data.amount);
  if (!Number.isFinite(amt) || amt <= 0) throw badRequest('সঠিক পরিমাণ দিন');

  const created = await CashboxEntry.create({
    owner: user._id,
    kind: parsed.data.kind,
    amount: amt,
    description: String(parsed.data.description || '').trim(),
    category: String(parsed.data.category || '').trim(),
    hasPhoto: !!parsed.data.hasPhoto,
    date: parsed.data.date,
  });

  return NextResponse.json(
    {
      ok: true,
      entry: cashboxEntryView(created),
      dashboard: await cashboxDashboard(user._id),
    },
    { status: 201 },
  );
});
