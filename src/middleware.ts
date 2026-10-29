import { NextRequest, NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/jwt';

const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/admin/dashboard';

/**
 * Guarda de acceso a nivel de borde: evita renderizar cualquier ruta /admin
 * sin una cookie de sesion valida.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') && !session) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === LOGIN_PATH && session) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
