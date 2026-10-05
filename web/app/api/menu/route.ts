import { NextResponse, type NextRequest } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { getMenu } from '@/lib/app-data';

/** GET /api/menu — the drawer's section list and counters. */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  return NextResponse.json(await getMenu(user));
});
