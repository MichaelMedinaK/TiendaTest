import { Store } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/components/LogoutButton';
import { MobileMenu } from '@/components/MobileMenu';
import { QuickAddButton } from '@/components/QuickAddButton';
import { SidebarNavigation } from '@/components/SidebarNavigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LOGIN_ROUTE } from '@/lib/constants';
import { ROLE_LABELS } from '@/lib/labels';
import { ROLE_HOME_ROUTE } from '@/lib/permissions';
import { getCurrentSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(LOGIN_ROUTE);
  }

  const homeHref = ROLE_HOME_ROUTE[session.role];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-zinc-950">
      <MobileMenu
        role={session.role}
        userName={session.name ?? session.email}
        roleLabel={ROLE_LABELS[session.role]}
        homeHref={homeHref}
      />

      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-zinc-200 bg-white p-4 md:flex dark:border-zinc-800 dark:bg-zinc-900/50 print:hidden">
        <div>
          <Link
            href={homeHref}
            aria-label="Ir al inicio"
            className="mb-6 flex items-center gap-3 rounded-lg px-2 py-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold text-zinc-900 dark:text-white">Tienda Test</span>
          </Link>
          <SidebarNavigation role={session.role} />
        </div>

        <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="px-2 text-sm font-semibold text-zinc-900 dark:text-white">{session.name ?? session.email}</p>
          <p className="px-2 pb-1 text-xs text-zinc-500 dark:text-zinc-400">{ROLE_LABELS[session.role]}</p>
          <ThemeToggle variant="sidebar" />
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-20 sm:p-6 sm:pb-20">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <QuickAddButton />
    </div>
  );
}
