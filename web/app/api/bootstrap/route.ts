import { NextResponse, type NextRequest } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { getMenu, getProfile, getSummary, getWallet } from '@/lib/app-data';

/** GET /api/bootstrap — one call that fills the home tab on cold start. */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);

  const [profile, summaryOut, wallet, menu] = await Promise.all([
    getProfile(user),
    getSummary(user._id),
    getWallet(user._id),
    getMenu(user),
  ]);

  return NextResponse.json({
    user: {
      id: String(user._id),
      name: user.name,
      phone: user.phone,
      photoUrl: user.photoUrl || '',
      role: user.role || 'user',
    },
    profile,
    summary: summaryOut,
    wallet,
    menu,
  });
});
