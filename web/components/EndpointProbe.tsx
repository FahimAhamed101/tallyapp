'use client';

import { useState } from 'react';
import type { EndpointDef } from '@/store/api';
import { Modal } from '@/components/ui';

/**
 * The API explorer's live-probe button.
 *
 * Client-side because it issues a real request from the browser and shows the
 * raw response — useful for confirming an endpoint's shape without curl.
 *
 * The catalogue itself is rendered on the server (see the page), so this is the
 * only part of the explorer that needs JavaScript.
 */
export default function EndpointProbe({ endpoint }: { endpoint: EndpointDef }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn-link" onClick={() => setOpen(true)}>
        চালান
      </button>
      {open ? <ProbeModal endpoint={endpoint} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ProbeModal({ endpoint, onClose }: { endpoint: EndpointDef; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [status, setStatus] = useState<number | null>(null);
  const [body, setBody] = useState('');

  const run = async () => {
    setState('loading');
    try {
      const res = await fetch(endpoint.path, { credentials: 'include' });
      const text = await res.text();
      setStatus(res.status);
      try {
        setBody(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setBody(text.slice(0, 4000));
      }
    } catch (e) {
      setStatus(0);
      setBody(String((e as Error).message));
    }
    setState('done');
  };

  return (
    <Modal
      title={`${endpoint.method} ${endpoint.path}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            বন্ধ করুন
          </button>
          <button className="btn btn-gold" onClick={run} disabled={state === 'loading'}>
            {state === 'loading' ? <span className="spinner" /> : null}
            {state === 'idle' ? 'চালান' : 'আবার চালান'}
          </button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        {endpoint.summary}
      </p>
      {status !== null ? (
        <div className={`notice ${status >= 200 && status < 300 ? 'ok' : 'error'}`}>
          HTTP {status}
        </div>
      ) : null}
      <pre
        className="mono"
        style={{
          background: '#f7f8fa',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 12,
          maxHeight: 380,
          overflow: 'auto',
          fontSize: 12,
          margin: 0,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {state === 'idle' ? '“চালান” চাপুন…' : body || '(খালি উত্তর)'}
      </pre>
    </Modal>
  );
}
