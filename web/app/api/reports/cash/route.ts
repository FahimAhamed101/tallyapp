import { NextResponse, type NextRequest } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope } from '@/lib/business';
import { cashReport, type ReportPeriod } from '@/lib/cash-report';

/**
 * GET /api/reports/cash?period=day|month&key=YYYY-MM-DD|YYYY-MM
 *
 * The ক্যাশ হিসাব screen's two tabs, from one place. `key` is the period the
 * user has paged to with the ‹ › arrows; omitting it means the current one.
 *
 * The opening balance is carried in from every earlier movement, so the rows
 * reconcile with বর্তমান ক্যাশ rather than floating free.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const period: ReportPeriod = req.nextUrl.searchParams.get('period') === 'month' ? 'month' : 'day';
  const key = req.nextUrl.searchParams.get('key');

  return NextResponse.json(await cashReport(scope, period, key));
});
