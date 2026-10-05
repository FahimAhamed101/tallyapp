const crypto = require('crypto');
const router = require('express').Router();
const { asyncHandler, badRequest } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const { uploadImage, destroyImage, isConfigured, MAX_BYTES } = require('../lib/cloudinary');

/**
 * Image uploads for customer/supplier avatars.
 *
 * The Android app posts a base64 data URI (it already has the bytes from the
 * camera or the gallery), we upload to Cloudinary with the API secret and hand
 * back only the public URL. The secret never reaches the device.
 */

/** GET /api/uploads/status — lets the app hide the photo button if unconfigured. */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    res.json({ configured: isConfigured(), maxBytes: MAX_BYTES });
  }),
);

/** POST /api/uploads  { data: "data:image/jpeg;base64,...", folder?, publicId? } */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data, mime, folder, publicId, tags } = req.body || {};
    if (!data) throw badRequest('ছবির ডেটা পাওয়া যায়নি');

    const ownerId = String(req.user._id);
    // Always mint a public_id, even when the caller did not supply one: the
    // owner prefix is what lets DELETE prove the asset belongs to this user.
    const suffix =
      String(publicId || '').trim() ||
      `${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;

    const result = await uploadImage(data, {
      mime,
      folder: folder ? `${process.env.CLOUDINARY_FOLDER || 'tallykhata'}/${folder}` : undefined,
      publicId: `${ownerId}_${suffix}`,
      tags,
    });

    res.status(201).json({
      ok: true,
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
    });
  }),
);

/**
 * DELETE /api/uploads/:publicId  or  DELETE /api/uploads?publicId=<id>
 *
 * Both forms exist because a Cloudinary public_id contains slashes
 * ("tallykhata/customers/<owner>_abc"), which is awkward to put in a path
 * segment — the query form sidesteps the escaping entirely.
 */
async function removeAsset(req, res) {
  const publicId = String(req.params.publicId || req.query.publicId || '').trim();
  if (!publicId) throw badRequest('ছবির আইডি দিন');

  // Only assets namespaced to this user may be deleted.
  const ownerId = String(req.user._id);
  if (!publicId.startsWith(`${ownerId}_`) && !publicId.includes(`/${ownerId}_`)) {
    throw badRequest('এই ছবিটি মুছে ফেলার অনুমতি নেই');
  }
  res.json({ ok: true, removed: await destroyImage(publicId) });
}

router.delete('/', requireAuth, asyncHandler(removeAsset));
router.delete('/:publicId', requireAuth, asyncHandler(removeAsset));

module.exports = router;
