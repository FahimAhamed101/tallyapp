import { NextResponse } from 'next/server';
import { handler } from '@/lib/api-helpers';
import { isConfigured, MAX_BYTES } from '@/lib/cloudinary';

/**
 * GET /api/uploads/status — lets the app hide the photo button if Cloudinary
 * is unconfigured. Public on purpose: it leaks no credentials.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  return NextResponse.json({ configured: isConfigured(), maxBytes: MAX_BYTES });
});
