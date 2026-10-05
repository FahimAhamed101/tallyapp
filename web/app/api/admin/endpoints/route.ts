import { NextResponse, type NextRequest } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { ENDPOINTS, GROUP_LABELS } from '@/lib/endpoints';

/**
 * GET /api/admin/endpoints — the machine-readable API catalogue.
 *
 * Served from the same module the panel's /admin/endpoints page renders, so the
 * docs and the UI can never disagree. Admin only.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const groups = Object.entries(GROUP_LABELS).map(([key, label]) => ({
    key,
    label,
    count: ENDPOINTS.filter((e) => e.group === key).length,
  }));

  return NextResponse.json({
    count: ENDPOINTS.length,
    groups,
    endpoints: ENDPOINTS,
  });
});
