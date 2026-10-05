import dns from 'node:dns';
import mongoose from 'mongoose';

/**
 * Cached MongoDB connection.
 *
 * Next.js reloads modules on every edit in dev, so a fresh `mongoose.connect()`
 * per module load would open a new pool each time and exhaust the cluster's
 * connection limit. Caching the promise on `globalThis` survives HMR.
 *
 * On this machine Node's c-ares resolver points at 127.0.0.1, which refuses SRV
 * queries, so `mongodb+srv://` fails with
 *   querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net
 * even though the OS resolver handles the record fine. Point c-ares at public
 * resolvers before the driver does its SRV lookup. (Same fix as the Express
 * backend's src/db.js.)
 */

const URI = process.env.MONGODB_URI;

if (!URI) {
  // Fail loud at import time rather than serving silently empty pages.
  throw new Error(
    'MONGODB_URI is not set. Copy .env.local.example to .env.local and fill it in.',
  );
}

const DEFAULT_DNS = ['8.8.8.8', '1.1.1.1'];

function applyDnsServers(): void {
  if (!URI?.startsWith('mongodb+srv://')) return;
  const configured = (process.env.DNS_SERVERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    dns.setServers(configured.length ? configured : DEFAULT_DNS);
  } catch (err) {
    console.warn('[db] could not set DNS servers:', (err as Error).message);
  }
}

applyDnsServers();

/** True when a connection failure looks like the SRV resolver, not the cluster. */
const isResolverFailure = (err: unknown) =>
  /querySrv|_mongodb\._tcp|ECONNREFUSED|ETIMEOUT|EAI_AGAIN|ENOTFOUND/i.test(
    (err as Error)?.message || '',
  );

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongo = globalThis as unknown as { _mongooseCache?: Cache };

const cached: Cache = (globalForMongo._mongooseCache ??= { conn: null, promise: null });

const connectOptions = {
  dbName: 'tally',
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 20000,
  connectTimeoutMS: 20000,
  socketTimeoutMS: 45000,
} as const;

export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  cached.promise ??= mongoose.connect(URI as string, connectOptions);

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset so the next request retries instead of re-awaiting a dead promise.
    cached.promise = null;

    /*
     * On the very first request after `next dev` starts, the SRV lookup can
     * still go out before c-ares has picked up the resolvers set above, and
     * fails with `querySrv ECONNREFUSED`. Every later request then succeeds,
     * which is a confusing first-impression bug for an uptime probe.
     *
     * Re-apply the resolvers and give it exactly one more try — a genuine
     * outage still fails, and it fails with the same message.
     */
    if (isResolverFailure(err)) {
      console.warn('[db] SRV lookup failed, re-applying resolvers and retrying once');
      applyDnsServers();
      cached.promise = mongoose.connect(URI as string, connectOptions);
      try {
        cached.conn = await cached.promise;
        return cached.conn;
      } catch (retryErr) {
        cached.promise = null;
        throw retryErr;
      }
    }

    throw err;
  }
  return cached.conn;
}

/** Health snapshot for GET /api/health — mirrors the Express response. */
export function dbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    db: states[mongoose.connection.readyState] || 'unknown',
    database: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
  };
}
