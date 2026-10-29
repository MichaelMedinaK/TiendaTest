import { redirect } from 'next/navigation';

import { DASHBOARD_ROUTE, LOGIN_ROUTE } from '@/lib/constants';
import { getCurrentSession } from '@/lib/session';

export default async function HomePage() {
  const session = await getCurrentSession();
  redirect(session ? DASHBOARD_ROUTE : LOGIN_ROUTE);
}
