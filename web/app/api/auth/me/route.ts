import { NextResponse, type NextRequest } from 'next/server';
import User from '@/lib/models/User';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';

/** GET /api/auth/me — used on cold start to decide login vs main app. */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  return NextResponse.json({ user: User.publicView(user) });
});
