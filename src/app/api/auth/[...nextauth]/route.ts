import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applyPlatformDefaults } from '@/lib/env';

applyPlatformDefaults();

export const maxDuration = 30;

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
