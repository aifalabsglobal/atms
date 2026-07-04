import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { applySecurityHeaders } from '@/lib/security-headers';

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'anon';
  return request.headers.get('x-real-ip') ?? 'anon';
}

const authMiddleware = withAuth({
  pages: { signIn: '/login' },
});

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname === '/api/health') {
    return applySecurityHeaders(NextResponse.next());
  }

  if (request.nextUrl.pathname.startsWith('/api/auth') && request.method === 'POST') {
    const ip = getClientIp(request);
    const limited = await enforceRateLimit(`auth:${ip}`, 15, 60_000);
    if (limited) return applySecurityHeaders(limited);
  }

  // @ts-expect-error next-auth middleware signature
  const response = await authMiddleware(request, event);
  return response ? applySecurityHeaders(response) : response;
}

export const config = {
  matcher: ['/', '/api/((?!auth|health).*)'],
};
