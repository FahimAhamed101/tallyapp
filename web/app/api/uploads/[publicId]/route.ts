import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { destroyImage } from '@/lib/cloudinary';
import type { RouteContext } from '@/lib/route-utils';

/**
 * DELETE /api/uploads/:publicId
 *
 * A Cloudinary public_id contains slashes, so this path form only works for a
 * single-segment id. The query form on /api/uploads is the general one; this
 * exists for parity with the Express router.
 */

export const dynamic = 'force-dynamic';

export const DELETE = handler(
  async (req: NextRequest, ctx: RouteContext<{ publicId: string }>) => {
    const { user } = await requireAuth(req);

    const publicId = decodeURIComponent(String(ctx.params.publicId || '')).trim();
    if (!publicId) throw badRequest('ছবির আইডি দিন');

    const ownerId = String(user._id);
    if (!publicId.startsWith(`${ownerId}_`) && !publicId.includes(`/${ownerId}_`)) {
      throw badRequest('এই ছবিটি মুছে ফেলার অনুমতি নেই');
    }

    return NextResponse.json({ ok: true, removed: await destroyImage(publicId) });
  },
);
