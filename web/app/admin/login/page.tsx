'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminLoginMutation } from '@/store/authApi';

/**
 * Panel sign-in.
 *
 * Deliberately outside the `(panel)` route group: that group's layout redirects
 * unauthenticated visitors to this page, so it must not guard itself.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [login, { isLoading }] = useAdminLoginMutation();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ phone, password }).unwrap();
      // refresh() re-runs the server layout so it re-reads the new cookie.
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      const msg = (err as { data?: { message?: string } })?.data?.message;
      setError(msg || 'লগইন করা যায়নি');
    }
  };

  const fillDemo = (e: React.MouseEvent) => {
    e.preventDefault();
    setPhone('admin@tallykhata.com');
    setPassword('123456');
    setError(null);
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img
            src="/app-logo.png"
            alt="TallyKhata Logo"
            width={64}
            height={64}
            style={{
              borderRadius: 16,
              objectFit: 'cover',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
              marginBottom: 10,
            }}
          />
          <h1>অ্যাডমিন প্যানেল</h1>
          <p>শুধুমাত্র অ্যাডমিন অ্যাকাউন্টের জন্য</p>
        </div>

        {error && <div className="notice error">{error}</div>}

        <div
          style={{
            background: 'rgba(217, 39, 44, 0.05)',
            border: '1px solid rgba(217, 39, 44, 0.15)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--red, #D9272C)', marginBottom: 4 }}>
            ডিফল্ট অ্যাডমিন তথ্য:
          </div>
          <div style={{ color: '#444' }}>
            <div><strong>ইমেইল:</strong> admin@tallykhata.com</div>
            <div><strong>মোবাইল:</strong> 01706617723</div>
            <div><strong>পাসওয়ার্ড:</strong> 123456</div>
          </div>
          <button
            type="button"
            onClick={fillDemo}
            className="btn btn-secondary"
            style={{ marginTop: 8, width: '100%', padding: '6px 10px', fontSize: 12 }}
          >
            অটো-ফিল করুন (Auto-Fill)
          </button>
        </div>

        <div className="field">
          <label htmlFor="phone">মোবাইল নম্বর বা ইমেইল</label>
          <input
            id="phone"
            type="text"
            autoComplete="username"
            placeholder="admin@tallykhata.com অথবা 01706617723"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">পাসওয়ার্ড</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingRight: 46 }}
            />
            <button
              type="button"
              className="btn-link"
              onClick={() => setShow((s) => !s)}
              style={{ position: 'absolute', right: 8, top: 8 }}
            >
              {show ? 'লুকান' : 'দেখান'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading}
          style={{ width: '100%', padding: '11px 15px', fontSize: 15, marginTop: 4 }}
        >
          {isLoading ? <span className="spinner" /> : null}
          {isLoading ? 'লগইন হচ্ছে…' : 'লগইন করুন'}
        </button>

        <p
          className="muted"
          style={{ fontSize: 12, textAlign: 'center', marginTop: 16, marginBottom: 0 }}
        >
          অ্যাডমিন নয় এমন অ্যাকাউন্ট দিয়ে লগইন করা যাবে না।
        </p>
      </form>
    </div>
  );
}
