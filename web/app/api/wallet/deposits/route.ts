import { NextResponse, type NextRequest } from 'next/server';
import Deposit, { DEPOSIT_PAYMENT, normalisePhone } from '@/lib/models/Deposit';
import { badRequest, conflict, handler, parseAmount, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { depositView, getWallet, listDeposits } from '@/lib/app-data';

/**
 * GET  /api/wallet/deposits  — this account's deposit requests, newest first.
 * POST /api/wallet/deposits  — submit a new one.
 *
 * The user sends money to the number in `DEPOSIT_PAYMENT` outside the app, then
 * tells us about it here. Nothing is credited by this route: an admin approves
 * the row before any balance moves, which is the whole point of a manual
 * system — the request is a claim, the approval is the payment.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  return NextResponse.json(await listDeposits(user._id));
});

export const POST = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const body = await readJson(req);

  const amount = parseAmount(body.amount);
  if (!Number.isFinite(amount) || amount < 1) {
    throw badRequest('টাকার পরিমাণ লিখুন');
  }
  if (amount > 500000) {
    throw badRequest('একবারে সর্বোচ্চ ৫,০০,০০০ টাকা যোগ করা যায়');
  }

  const senderNumber = normalisePhone(body.senderNumber);
  if (!senderNumber) {
    throw badRequest('যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি ১১ ডিজিটে লিখুন');
  }

  const trxId = String(body.trxId ?? '').trim().toUpperCase();
  if (trxId.length < 4) {
    throw badRequest('ট্রানজেকশন আইডি লিখুন');
  }

  // A transaction id identifies exactly one payment, so it can only ever back
  // one request. Without this the same bKash SMS could be claimed twice by two
  // accounts, and an admin working down the queue could approve both.
  const existing = await Deposit.findOne({ trxId }).select('status').lean();
  if (existing) {
    throw conflict(
      existing.status === 'approved'
        ? 'এই ট্রানজেকশন আইডি দিয়ে আগেই ব্যালেন্স যোগ করা হয়েছে'
        : 'এই ট্রানজেকশন আইডি দিয়ে একটি রিকোয়েস্ট জমা আছে',
    );
  }

  // Same sender, same amount, inside the wait window, still unreviewed: that is
  // the user double-tapping or retrying after a timeout, not a second payment.
  // Hand back the row that already exists rather than stacking a copy the admin
  // would have to puzzle over.
  const since = new Date(Date.now() - DEPOSIT_PAYMENT.waitHours * 3600_000);
  const duplicate = await Deposit.findOne({
    owner: user._id,
    senderNumber,
    amount,
    trxId,
    status: 'pending',
    createdAt: { $gte: since },
  });

  if (duplicate) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      deposit: depositView(duplicate as never),
      wallet: await getWallet(user._id),
    });
  }

  const created = await Deposit.create({
    owner: user._id,
    amount,
    senderNumber,
    trxId,
    status: 'pending',
  });

  return NextResponse.json(
    {
      ok: true,
      deposit: depositView(created as never),
      wallet: await getWallet(user._id),
    },
    { status: 201 },
  );
});