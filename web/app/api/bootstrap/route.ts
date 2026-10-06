import { NextResponse, type NextRequest } from 'next/server';
import Business from '@/lib/models/Business';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { listBusinesses, resolveScope } from '@/lib/business';
import { getMenu, getProfile, getSummary, getWallet } from '@/lib/app-data';

/** GET /api/bootstrap — one call that fills the home tab on cold start. */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { business, scope } = await resolveScope(req, user);

  const [profile, summaryOut, wallet, menu, businesses] = await Promise.all([
    getProfile(user),
    getSummary(scope),
    getWallet(user._id),
    getMenu(user, scope),
    listBusinesses(user),
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
    /**
     * মাল্টি ব্যবসা. The switcher sheet renders straight from this, so opening
     * it costs no extra round trip, and `activeBusinessName` is what the gold
     * toolbar shows — the book you are in, not the account holder's name.
     */
    businesses,
    activeBusinessId: String(business._id),
    activeBusinessName: business.name,
    maxBusinesses: Business.MAX,
  });
});
