import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { db, isConnectionError } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { applyPlatformDefaults } from '@/lib/env';
import { consumeKnuctLoginGrant } from '@/lib/knuct/login-grant';
import { revokeUserKnuctSession } from '@/lib/knuct/knuct-persistent-session';
import { isPlaceholderPasswordHash, verifyPlaceholderPassword } from '@/lib/demo-mode';
import { isGoogleSsoConfigured, verifyMfaToken } from '@/lib/mfa';
import type { Role } from '@/lib/store';

applyPlatformDefaults();

const JWT_DB_REFRESH_MS = 15 * 60 * 1000;

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

async function buildAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  profileImageUrl: string | null;
  linkedStudentId: string | null;
}) {
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    department: user.department ?? undefined,
    profileImageUrl: user.profileImageUrl ?? undefined,
    linkedStudentId: user.linkedStudentId ?? undefined,
  };
}

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
      mfaCode: { label: 'MFA Code', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      try {
        const user = await db.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });

        if (!user || user.status !== 'active') return null;

        const {
          getAuthSettings,
          getLoginLockState,
          recordLoginFailure,
          clearLoginFailures,
        } = await import('@/lib/settings/auth-config');
        const authSettings = await getAuthSettings();
        const lock = getLoginLockState(credentials.email);
        if (lock.locked) {
          throw new Error(`ACCOUNT_LOCKED:${lock.retryAfterSeconds}`);
        }

        const valid = isPlaceholderPasswordHash(user.passwordHash)
          ? verifyPlaceholderPassword(credentials.password)
          : await bcrypt.compare(credentials.password, user.passwordHash);

        if (!valid) {
          const { locked } = recordLoginFailure(credentials.email, authSettings);
          const { getGlobalBoolean } = await import('@/lib/settings');
          const logFailed = await getGlobalBoolean('audit.log_failed_logins', true);
          if (logFailed) {
            await logAudit({
              userId: user.id,
              action: 'login.failed',
              resource: `user:${user.id}`,
              details: { email: user.email, locked },
            });
          }
          if (locked) {
            throw new Error(`ACCOUNT_LOCKED:${authSettings.lockoutMinutes * 60}`);
          }
          return null;
        }

        clearLoginFailures(credentials.email);

        if (user.mfaEnabled) {
          const code = credentials.mfaCode?.trim() ?? '';
          if (!code) {
            throw new Error('MFA_REQUIRED');
          }
          if (!user.mfaSecret || !verifyMfaToken(user.mfaSecret, code)) {
            throw new Error('MFA_INVALID');
          }
        }

        await logAudit({
          userId: user.id,
          action: 'login',
          resource: `user:${user.id}`,
          details: {
            email: user.email,
            role: user.role,
            method: user.mfaEnabled ? 'password_mfa' : 'password',
          },
        });

        return buildAuthUser(user);
      } catch (err) {
        if (err instanceof Error && (err.message === 'MFA_REQUIRED' || err.message === 'MFA_INVALID')) {
          throw err;
        }
        if (err instanceof Error && err.message.startsWith('ACCOUNT_LOCKED:')) {
          throw err;
        }
        console.error('[auth] authorize failed:', err);
        if (isConnectionError(err)) {
          throw new Error('DatabaseConnectionError');
        }
        return null;
      }
    },
  }),
  CredentialsProvider({
    id: 'knuct',
    name: 'Knuct DID',
    credentials: {
      loginToken: { label: 'Login Token', type: 'password' },
    },
    async authorize(credentials) {
      const userId = await consumeKnuctLoginGrant(credentials?.loginToken);
      if (!userId) return null;

      try {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user || user.status !== 'active') return null;

        await logAudit({
          userId: user.id,
          action: 'login',
          resource: `user:${user.id}`,
          details: { email: user.email, role: user.role, method: 'knuct_did' },
        });

        return buildAuthUser(user);
      } catch (err) {
        console.error('[auth] knuct authorize failed:', err);
        return null;
      }
    },
  }),
];

if (isGoogleSsoConfigured()) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // Upper bound matches general.session_timeout_minutes max (7 days).
  // Effective idle/session length is also enforced in the jwt callback from campus settings.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/login', error: '/login' },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true;
      if (!user.email) return false;

      const dbUser = await db.user.findUnique({
        where: { email: user.email.trim().toLowerCase() },
      });
      if (!dbUser || dbUser.status !== 'active') {
        return '/login?error=GoogleAccountNotLinked';
      }

      user.id = dbUser.id;
      (user as { role?: Role }).role = dbUser.role as Role;
      (user as { department?: string }).department = dbUser.department ?? undefined;
      (user as { profileImageUrl?: string }).profileImageUrl = dbUser.profileImageUrl ?? undefined;
      (user as { linkedStudentId?: string }).linkedStudentId = dbUser.linkedStudentId ?? undefined;

      await logAudit({
        userId: dbUser.id,
        action: 'login',
        resource: `user:${dbUser.id}`,
        details: { email: dbUser.email, role: dbUser.role, method: 'google_sso' },
      });
      await db.user.update({
        where: { id: dbUser.id },
        data: { lastLoginAt: new Date() },
      });

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? 'visitor';
        token.department = (user as { department?: string }).department;
        token.profileImageUrl = (user as { profileImageUrl?: string }).profileImageUrl;
        token.linkedStudentId = (user as { linkedStudentId?: string }).linkedStudentId;
        token.active = true;
        token.iat = Math.floor(Date.now() / 1000);
      }

      // Align JWT lifetime with campus idle logout (general.session_timeout_minutes).
      try {
        const { getGlobalNumber } = await import('@/lib/settings/service');
        const minutes = await getGlobalNumber('general.session_timeout_minutes', 480);
        const maxAgeSec = Math.min(10080, Math.max(15, Math.round(minutes) || 480)) * 60;
        const issuedAt = typeof token.iat === 'number' ? token.iat : 0;
        if (issuedAt > 0 && Math.floor(Date.now() / 1000) - issuedAt > maxAgeSec) {
          token.active = false;
          return token;
        }
      } catch {
        // Settings DB unavailable — keep token; client idle logout still applies.
      }

      if (token.id) {
        const lastRefresh = (token.refreshedAt as number | undefined) ?? 0;
        const shouldRefresh = user || Date.now() - lastRefresh > JWT_DB_REFRESH_MS;
        if (shouldRefresh) {
          try {
            const dbUser = await db.user.findUnique({
              where: { id: token.id as string },
              select: {
                role: true,
                department: true,
                profileImageUrl: true,
                linkedStudentId: true,
                status: true,
                name: true,
              },
            });
            if (dbUser?.status === 'active') {
              token.role = dbUser.role as Role;
              token.department = dbUser.department ?? undefined;
              token.profileImageUrl = dbUser.profileImageUrl ?? undefined;
              token.linkedStudentId = dbUser.linkedStudentId ?? undefined;
              token.name = dbUser.name;
              token.active = true;
            } else {
              token.active = false;
            }
            token.refreshedAt = Date.now();
          } catch (err) {
            console.error('[auth] JWT refresh skipped (DB unavailable):', err);
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.active === false || !token.id) {
        return { ...session, expires: new Date(0).toISOString() };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.department = token.department as string | undefined;
        session.user.profileImageUrl = token.profileImageUrl as string | undefined;
        session.user.linkedStudentId = token.linkedStudentId as string | undefined;
        session.user.avatar = initialsFromName(session.user.name ?? '');
      }
      return session;
    },
  },
  events: {
    async signOut({ token, session }) {
      const userId = (token?.id as string | undefined) ?? session?.user?.id;
      if (!userId) return;
      try {
        await revokeUserKnuctSession(userId);
      } catch (err) {
        console.warn('[auth] Knuct session revoke on signOut failed:', err);
      }
    },
  },
};
