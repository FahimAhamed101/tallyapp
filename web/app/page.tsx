import Link from 'next/link';
import { ENDPOINTS } from '@/lib/endpoints';

/**
 * Landing page. This is a server component, so the endpoint count is rendered
 * from the same module the API serves — no client fetch, no drift.
 */
export default function HomePage() {
  const groups = new Set(ENDPOINTS.map((e) => e.group));

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <div className="login-brand">
          <div className="login-mark">ট</div>
          <h1>টালিখাতা — Next.js API</h1>
          <p>The Android backend, ported to App Router route handlers</p>
        </div>

        <dl className="kv" style={{ marginBottom: 18 }}>
          <dt>Endpoints</dt>
          <dd>
            <b>{ENDPOINTS.length}</b> across {groups.size} groups
          </dd>
          <dt>Runtime</dt>
          <dd>Next.js 14 App Router · port 4000</dd>
          <dt>Android client</dt>
          <dd>
            Unchanged — same paths, same JSON, same Bengali strings
          </dd>
        </dl>

        <Link
          href="/admin"
          className="btn btn-primary"
          style={{ width: '100%', padding: '11px 15px', fontSize: 15 }}
        >
          অ্যাডমিন প্যানেলে যান
        </Link>

        <p
          className="muted"
          style={{ fontSize: 12.5, textAlign: 'center', marginTop: 14, marginBottom: 0 }}
        >
          API health: <code className="mono">/api/health</code>
        </p>
      </div>
    </div>
  );
}
