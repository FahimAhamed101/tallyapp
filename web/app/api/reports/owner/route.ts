import { NextResponse, type NextRequest } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope } from '@/lib/business';
import { ownerReport } from '@/lib/cash-report';

/**
 * GET /api/reports/owner?key=YYYY-MM
 *
 * মালিকের রিপোর্ট — the owner's deposits and withdrawals, grouped by day.
 * Always monthly: the screen has no day/week mode.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  return NextResponse.json(await ownerReport(scope, req.nextUrl.searchParams.get('key')));
});
