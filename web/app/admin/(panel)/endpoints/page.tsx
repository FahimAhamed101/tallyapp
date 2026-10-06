import { ENDPOINTS, GROUP_LABELS, AUTH_LABELS, type EndpointDef } from '@/lib/endpoints';
import EndpointProbe from '@/components/EndpointProbe';

/**
 * The API explorer.
 *
 * This is a server component and reads `lib/endpoints.ts` directly — the same
 * module `GET /api/admin/endpoints` serialises and the smoke script walks. That
 * means the list is guaranteed complete and correct with no client fetch, and
 * it is in the HTML on first paint.
 *
 * The one interactive piece (issuing a live request) is a small client
 * component; every other panel screen uses RTK Query for its live data.
 */

export const dynamic = 'force-dynamic';

const AUTH_CHIP: Record<string, string> = {
  public: 'gray',
  bearer: 'blue',
  session: 'green',
  admin: 'gold',
};

/**
 * Display order comes from `GROUP_LABELS`, which is typed as a full
 * `Record<EndpointDef['group'], string>`. Adding a route group to the catalogue
 * therefore fails to compile until it is labelled — and it can never be
 * silently dropped from this page the way a hand-maintained list would be.
 */
const GROUP_ORDER = Object.keys(GROUP_LABELS) as EndpointDef['group'][];

export default function EndpointsPage() {
  const groups = GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: ENDPOINTS.filter((e) => e.group === key),
  })).filter((g) => g.items.length);

  const byAuth = (['public', 'bearer', 'session', 'admin'] as const).map((a) => ({
    level: a,
    count: ENDPOINTS.filter((e) => e.auth === a).length,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>API এন্ডপয়েন্ট</h1>
          <p>
            এই Next.js অ্যাপে থাকা সব রুট — মোট <b>{ENDPOINTS.length}</b> টি, {groups.length} টি
            গ্রুপে। অ্যান্ড্রয়েড অ্যাপের সব এন্ডপয়েন্ট এখানে App Router রুট হ্যান্ডলার হিসেবে
            আবার লেখা হয়েছে।
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat gold">
          <div className="k">মোট এন্ডপয়েন্ট</div>
          <div className="v">{ENDPOINTS.length}</div>
          <div className="s">{groups.length} টি গ্রুপ</div>
        </div>
        {byAuth.map((b) => (
          <div className="stat" key={b.level}>
            <div className="k">{AUTH_LABELS[b.level]}</div>
            <div className="v">{b.count}</div>
            <div className="s">রুট</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>গ্রুপ</h2>
          <span className="grow" />
          <span className="muted mono" style={{ fontSize: 12 }}>
            JSON: GET /api/admin/endpoints
          </span>
        </div>
        <div className="card-body">
          <div className="toolbar">
            {groups.map((g) => (
              <a key={g.key} href={`#group-${g.key}`} className="btn btn-ghost btn-sm">
                {g.label} · {g.items.length}
              </a>
            ))}
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <div className="card" key={g.key} id={`group-${g.key}`}>
          <div className="card-head">
            <h2>{g.label}</h2>
            <span className="chip gray">{g.items.length}</span>
          </div>
          <div>
            {g.items.map((e) => (
              <div className="ep" key={`${e.method} ${e.path}`}>
                <span className={`verb ${e.method}`}>{e.method}</span>
                <div className="ep-main">
                  <div className="ep-path">{e.path}</div>
                  <div className="ep-sum">{e.summary}</div>
                  <div className="ep-meta">
                    {e.params ? (
                      <span>
                        params <code>{e.params}</code>
                      </span>
                    ) : null}
                    {e.body ? (
                      <span>
                        body <code>{e.body}</code>
                      </span>
                    ) : null}
                    {e.returns ? (
                      <span>
                        returns <code>{e.returns}</code>
                      </span>
                    ) : null}
                    {e.alias ? (
                      <span className="chip purple">
                        POST + X-HTTP-Method-Override: PATCH
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="ep-auth">
                  <span className={`chip ${AUTH_CHIP[e.auth]}`}>{AUTH_LABELS[e.auth]}</span>
                  {e.method === 'GET' && !e.path.includes(':') ? (
                    <span style={{ marginLeft: 8, display: 'inline-block' }}>
                      <EndpointProbe endpoint={e} />
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <div className="card-head">
          <h2>অ্যান্ড্রয়েড অ্যাপের সাথে মিল</h2>
        </div>
        <div className="card-body">
          <div className="notice info">
            অ্যাপের <code className="mono">ApiClient.baseUrl</code> এখনো{' '}
            <code className="mono">http://127.0.0.1:4000/api</code> — একই পাথ, একই JSON, একই বাংলা
            লেখা। Express সার্ভার বন্ধ করে এই Next.js অ্যাপ চালালে অ্যাপে কোনো পরিবর্তন লাগবে না।
            শুধু <code className="mono">adb reverse tcp:4000 tcp:4000</code> চালু রাখতে হবে।
          </div>
          <div className="notice warn" style={{ marginBottom: 0 }}>
            <b>PATCH নোট:</b> অ্যান্ড্রয়েডের <code className="mono">HttpURLConnection</code> PATCH
            পাঠাতে পারে না, তাই অ্যাপ{' '}
            <code className="mono">POST + X-HTTP-Method-Override: PATCH</code> পাঠায়। উপরে যেসব রুটে{' '}
            <span className="chip purple">override</span> লেখা আছে, সেগুলো দুই ভাবেই কাজ করে —
            <code className="mono">/api/profile</code> এবং{' '}
            <code className="mono">/api/customers/:id</code>।
          </div>
        </div>
      </div>
    </>
  );
}
