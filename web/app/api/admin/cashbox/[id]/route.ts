import { NextResponse, type NextRequest } from 'next/server';
import CashboxEntry from '@/lib/models/CashboxEntry';
import { badRequest, handler, isObjectId, notFound, parseAmount, readJson } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { adminCashboxUpdateSchema, formatZodError } from '@/lib/validators';
import { cashboxDashboard, cashboxEntryView } from '@/lib/app-data';

/**
 * PATCH  /api/admin/cashbox/:id — correct a cash-box entry
 * DELETE /api/admin/cashbox/:id — remove it
 *
 * Admin only. The owning user's recomputed dashboard comes back with the
 * response so the panel's totals stay in step without a second round trip.
 */

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

async function load(id: string) {
  if (!isObjectId(id)) throw notFound('এন্ট্রি পাওয়া যায়নি');
  const doc = await CashboxEntry.findById(id);
  if (!doc) throw notFound('এন্ট্রি পাওয়া যায়নি');
  return doc;
}

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  const body = await readJson(req);
  const parsed = adminCashboxUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const { kind, description, category, hasPhoto, date } = parsed.data;

  if (body.amount !== undefined) {
    const amt = parseAmount(body.amount);
    if (!Number.isFinite(amt) || amt <= 0) throw badRequest('সঠিক পরিমাণ দিন');
    doc.amount = amt;
  }
  if (kind !== undefined) doc.kind = kind;
  if (description !== undefined) doc.description = String(description || '').trim();
  if (category !== undefined) doc.category = String(category || '').trim();
  if (hasPhoto !== undefined) doc.hasPhoto = !!hasPhoto;
  if (date !== undefined) doc.date = new Date(date);

  await doc.save();

  return NextResponse.json({
    ok: true,
    entry: cashboxEntryView(doc),
    // Whole-account scope: the panel deliberately spans every business the
    // owning user has, not just whichever one is active on their phone.
    dashboard: await cashboxDashboard({ owner: doc.owner, business: null }),
  });
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  const owner = doc.owner;
  await doc.deleteOne();

  return NextResponse.json({
    ok: true,
    deletedId: ctx.params.id,
    dashboard: await cashboxDashboard({ owner, business: null }),
  });
});
