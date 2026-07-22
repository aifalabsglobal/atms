import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { enforceRateLimit } from '@/lib/rate-limit';
import { applySecurityHeaders } from '@/lib/security-headers';
import { applyPlatformDefaults } from '@/lib/env';

applyPlatformDefaults();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'anon';
  return request.headers.get('x-real-ip') ?? 'anon';
}

const PUBLIC_EXACT = new Set([
  '/api/health',
  '/api/knuct/login',
  '/api/register',
  '/register',
  '/verify',
  '/knuct/login',
  '/knuct/register',
  '/knuct/verify',
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith('/api/verify')) return true;
  return false;
}

function jsonUnauthorized() {
  return applySecurityHeaders(
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  );
}

const authMiddleware = withAuth({
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
});

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  if (pathname === '/register') {
    const url = request.nextUrl.clone();
    url.pathname = '/knuct/register';
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  if (pathname === '/verify') {
    const url = request.nextUrl.clone();
    url.pathname = '/knuct/verify';
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  if (isPublicPath(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith('/api/auth') && request.method === 'POST') {
    const ip = getClientIp(request);
    const limited = await enforceRateLimit(`auth:${ip}`, 15, 60_000);
    if (limited) return applySecurityHeaders(limited);
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Knuct interactive APIs — JSON 401 (no HTML redirect to campus /login)
  if (
    (pathname.startsWith('/api/knuct') && pathname !== '/api/knuct/login') ||
    pathname.startsWith('/api/register/requests')
  ) {
    if (!token?.id || token.active === false) return jsonUnauthorized();
    return applySecurityHeaders(NextResponse.next());
  }

  // Standalone Knuct console pages
  if (pathname === '/knuct' || pathname.startsWith('/knuct/')) {
    if (!token?.id || token.active === false || token.authSurface !== 'knuct') {
      const url = request.nextUrl.clone();
      url.pathname = '/knuct/login';
      url.searchParams.set('callbackUrl', pathname);
      return applySecurityHeaders(NextResponse.redirect(url));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Campus SPA: knuct-surface sessions belong on /knuct
  if (pathname === '/' && token?.authSurface === 'knuct') {
    const url = request.nextUrl.clone();
    url.pathname = '/knuct';
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  // @ts-expect-error next-auth middleware signature
  const response = await authMiddleware(request, event);
  return response ? applySecurityHeaders(response) : response;
}

export const config = {
  matcher: ['/', '/knuct', '/knuct/:path*', '/register', '/verify', '/api/((?!auth|health).*)'],
};
