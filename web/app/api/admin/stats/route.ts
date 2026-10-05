import { NextResponse, type NextRequest } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { platformStats } from '@/lib/admin';

/**
 * GET /api/admin/stats — platform-wide totals for the panel dashboard.
 * Admin only.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  return NextResponse.json(await platformStats());
});
