import { redirect } from 'next/navigation';

import { LOGIN_ROUTE } from '@/lib/constants';
import { ROLE_HOME_ROUTE } from '@/lib/permissions';
import { getCurrentSession } from '@/lib/session';

export default async function HomePage() {
  const session = await getCurrentSession();
  redirect(session ? ROLE_HOME_ROUTE[session.role] : LOGIN_ROUTE);
}
