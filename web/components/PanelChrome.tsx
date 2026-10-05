'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminLogoutMutation } from '@/store/authApi';

/** The panel's top bar, side navigation and sign-out button. */

const NAV: { href: string; label: string; icon: string; exact?: boolean }[] = [
  { href: '/admin', label: 'ড্যাশবোর্ড', icon: '▦', exact: true },
  { href: '/admin/users', label: 'ব্যবহারকারী', icon: '☰' },
  { href: '/admin/customers', label: 'কাস্টমার ও সাপ্লায়ার', icon: '◍' },
  { href: '/admin/transactions', label: 'লেনদেন', icon: '⇄' },
  { href: '/admin/cashbox', label: 'ক্যাশবক্স', icon: '▤' },
  { href: '/admin/endpoints', label: 'API এন্ডপয়েন্ট', icon: '{}' },
];

export default function PanelChrome({
  user,
  children,
}: {
  user: { name: string; phone: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [logout, { isLoading }] = useAdminLogoutMutation();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const signOut = async () => {
    try {
      await logout().unwrap();
    } catch {
      /* the cookie is cleared server-side either way; fall through to redirect */
    }
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img
            src="/app-logo.png"
            alt="TallyKhata"
            width={32}
            height={32}
            style={{ borderRadius: 8, objectFit: 'cover', display: 'inline-block' }}
          />
          <span>
            টালিখাতা
            <small>SUPERADMIN</small>
          </span>
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-user">
          <b>{user.name}</b>
          <span>{user.phone}</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={signOut}
          disabled={isLoading}
        >
          {isLoading ? <span className="spinner" /> : null}
          লগআউট
        </button>
      </header>

      <div className="shell">
        <nav className="sidenav">
          <div className="sidenav-group">পরিচালনা</div>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href, item.exact) ? 'active' : ''}
            >
              <span className="nav-ico">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div className="sidenav-group">অন্য</div>
          <Link href="/" target="_blank">
            <span className="nav-ico">↗</span>
            পাবলিক হোম
          </Link>
          <Link href="/api/health" target="_blank">
            <span className="nav-ico">♥</span>
            হেলথ চেক
          </Link>
        </nav>

        <main className="main">{children}</main>
      </div>
    </div>
  );
}
