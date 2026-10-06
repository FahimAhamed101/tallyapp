import { NextResponse, type NextRequest } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope } from '@/lib/business';
import { cashboxDashboard } from '@/lib/app-data';

/** GET /api/cashbox -> ক্যাশবক্স dashboard */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);
  return NextResponse.json(await cashboxDashboard(scope));
});
