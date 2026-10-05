import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, handler, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { destroyImage, uploadImage } from '@/lib/cloudinary';
import { effectiveMethod } from '@/lib/route-utils';

/**
 * Image uploads for customer/supplier avatars.
 *
 * The Android app posts a base64 data URI (it already has the bytes from the
 * camera or the gallery), we upload to Cloudinary with the API secret and hand
 * back only the public URL. The secret never reaches the device.
 *
 *   POST   /api/uploads                        { data, mime?, folder?, publicId? }
 *   DELETE /api/uploads?publicId=<id>          query form (a public_id has slashes)
 */

export const dynamic = 'force-dynamic';

/**
 * Both forms exist because a Cloudinary public_id contains slashes
 * ("tallykhata/customers/<owner>_abc"), which is awkward to put in a path
 * segment — the query form sidesteps the escaping entirely.
 */
async function removeAsset(req: NextRequest) {
  const { user } = await requireAuth(req);

  const publicId = String(
    req.nextUrl.searchParams.get('publicId') || '',
  ).trim();
  if (!publicId) throw badRequest('ছবির আইডি দিন');

  // Only assets namespaced to this user may be deleted.
  const ownerId = String(user._id);
  if (!publicId.startsWith(`${ownerId}_`) && !publicId.includes(`/${ownerId}_`)) {
    throw badRequest('এই ছবিটি মুছে ফেলার অনুমতি নেই');
  }

  return NextResponse.json({ ok: true, removed: await destroyImage(publicId) });
}

export const POST = handler(async (req: NextRequest) => {
  // `HttpURLConnection` cannot send DELETE either, so accept the override form.
  if (effectiveMethod(req) === 'DELETE') return removeAsset(req);

  const { user } = await requireAuth(req);
  const body = await readJson(req);

  const data = body.data;
  if (!data) throw badRequest('ছবির ডেটা পাওয়া যায়নি');

  const ownerId = String(user._id);
  // Always mint a public_id, even when the caller did not supply one: the
  // owner prefix is what lets DELETE prove the asset belongs to this user.
  const suffix =
    String(body.publicId || '').trim() ||
    `${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;

  const folderBase = process.env.CLOUDINARY_FOLDER || 'tallykhata';
  const result = await uploadImage(data, {
    mime: typeof body.mime === 'string' ? body.mime : undefined,
    folder: body.folder ? `${folderBase}/${body.folder}` : undefined,
    publicId: `${ownerId}_${suffix}`,
    tags: typeof body.tags === 'string' ? body.tags : undefined,
  });

  return NextResponse.json(
    {
      ok: true,
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
    },
    { status: 201 },
  );
});

export const DELETE = handler(async (req: NextRequest) => removeAsset(req));
