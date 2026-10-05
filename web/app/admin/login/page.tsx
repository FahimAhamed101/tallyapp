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

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="login-mark">ট</div>
          <h1>অ্যাডমিন প্যানেল</h1>
          <p>শুধুমাত্র অ্যাডমিন অ্যাকাউন্টের জন্য</p>
        </div>

        {error && <div className="notice error">{error}</div>}

        <div className="field">
          <label htmlFor="phone">মোবাইল নম্বর</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="+8801706617723"
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
