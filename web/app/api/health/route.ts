import { NextResponse } from 'next/server';
import { dbConnect, dbStatus } from '@/lib/mongodb';
import { handler } from '@/lib/api-helpers';

/**
 * GET /api/health — same envelope as the Express backend so any uptime check
 * pointed at the old server keeps working after the port.
 */

export const dynamic = 'force-dynamic';

const startedAt = Date.now();

export const GET = handler(async () => {
  await dbConnect();
  const { db, database, host } = dbStatus();
  return NextResponse.json({
    ok: db === 'connected',
    db,
    database,
    host,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    runtime: 'nextjs',
  });
});
