import { Store } from 'lucide-react';
import { redirect } from 'next/navigation';

import { LogoutButton } from '@/components/LogoutButton';
import { SidebarNavigation } from '@/components/SidebarNavigation';
import { LOGIN_ROUTE } from '@/lib/constants';
import { ROLE_LABELS } from '@/lib/labels';
import { getCurrentSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(LOGIN_ROUTE);
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 md:flex print:hidden">
        <div>
          <div className="mb-6 flex items-center gap-2 px-2">
            <Store className="h-6 w-6 text-brand-600" />
            <span className="text-lg font-bold text-slate-900">Tienda Test</span>
          </div>
          <SidebarNavigation role={session.role} />
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="px-2 text-sm font-semibold text-slate-800">{session.name ?? session.email}</p>
          <p className="mb-3 px-2 text-xs text-slate-500">{ROLE_LABELS[session.role]}</p>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
