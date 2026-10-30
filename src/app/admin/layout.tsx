import { Store } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/components/LogoutButton';
import { MobileMenu } from '@/components/MobileMenu';
import { NewSaleButton } from '@/components/NewSaleButton';
import { SidebarNavigation } from '@/components/SidebarNavigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LOGIN_ROUTE } from '@/lib/constants';
import { ROLE_LABELS } from '@/lib/labels';
import { ROLE_HOME_ROUTE, canAccessRoute } from '@/lib/permissions';
import { getCurrentSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(LOGIN_ROUTE);
  }

  const canCreateSales = canAccessRoute(session.role, '/admin/ventas');
  const homeHref = ROLE_HOME_ROUTE[session.role];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileMenu
        role={session.role}
        userName={session.name ?? session.email}
        roleLabel={ROLE_LABELS[session.role]}
        homeHref={homeHref}
      />

      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 md:flex print:hidden">
        <div>
          <Link
            href={homeHref}
            aria-label="Ir al inicio"
            className="mb-6 flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-slate-100"
          >
            <Store className="h-6 w-6 text-brand-600" />
            <span className="text-lg font-bold text-slate-900">Tienda Test</span>
          </Link>
          {canCreateSales && <NewSaleButton variant="sidebar" />}
          <SidebarNavigation role={session.role} />
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <p className="px-2 text-sm font-semibold text-slate-800">{session.name ?? session.email}</p>
          <p className="px-2 pb-1 text-xs text-slate-500">{ROLE_LABELS[session.role]}</p>
          <ThemeToggle variant="sidebar" />
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 md:pb-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {canCreateSales && <NewSaleButton variant="floating" />}
    </div>
  );
}
