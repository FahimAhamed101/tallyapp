import { NextResponse, type NextRequest } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';

/** GET /api/admin/me — who the panel is signed in as. */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAdmin(req);
  return NextResponse.json({
    user: {
      id: String(user._id),
      name: user.name,
      phone: user.phone,
      photoUrl: user.photoUrl || '',
      role: user.role,
    },
  });
});
