import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import PanelChrome from '@/components/PanelChrome';

/**
 * The guarded panel shell.
 *
 * This is a server component, so the role check runs before a single byte of
 * panel HTML is generated — an unauthenticated or non-admin visitor is
 * redirected, never sent the UI and then bounced by a client effect.
 *
 * It lives in the `(panel)` route group so `/admin/login` sits outside it and
 * can render for a signed-out visitor.
 */

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminSession();
  if (!user) redirect('/admin/login');

  return (
    <PanelChrome user={{ name: user.name, phone: user.phone, role: user.role }}>
      {children}
    </PanelChrome>
  );
}
