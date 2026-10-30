import { NextRequest, NextResponse } from 'next/server';

import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/jwt';
import { ROLE_HOME_ROUTE, canAccessRoute } from '@/lib/permissions';

const LOGIN_PATH = '/login';

/**
 * Guarda de acceso a nivel de borde: evita renderizar cualquier ruta /admin
 * sin una cookie de sesion valida o a un rol sin permiso sobre ese modulo.
 */
export async function middleware(request: NextRequest) {
  // Las Server Actions (POST con cabecera Next-Action) validan la sesion por si mismas y devuelven un
  // resultado con mensaje. Redirigirlas a /login haria que el cliente reciba `undefined` y falle.
  if (request.headers.has('next-action')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!canAccessRoute(session.role, pathname)) {
      return NextResponse.redirect(new URL(ROLE_HOME_ROUTE[session.role], request.url));
    }
  }

  if (pathname === LOGIN_PATH && session) {
    return NextResponse.redirect(new URL(ROLE_HOME_ROUTE[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
