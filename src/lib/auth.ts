import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import type { Role } from '@/lib/store';

const JWT_DB_REFRESH_MS = 5 * 60 * 1000;

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user || user.status !== 'active') return null;

          const valid =
            user.passwordHash === '$2a$10$placeholder'
              ? credentials.password === 'demo123'
              : await bcrypt.compare(credentials.password, user.passwordHash);

          if (!valid) return null;

          await db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          await logAudit({
            userId: user.id,
            action: 'login',
            resource: `user:${user.id}`,
            details: { email: user.email, role: user.role },
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
        } catch (err) {
          console.error('[auth] authorize failed:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? 'visitor';
        token.department = (user as { department?: string }).department;
        token.profileImageUrl = (user as { profileImageUrl?: string }).profileImageUrl;
        token.linkedStudentId = (user as { linkedStudentId?: string }).linkedStudentId;
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
            if (dbUser && dbUser.status === 'active') {
              token.role = dbUser.role as Role;
              token.department = dbUser.department ?? undefined;
              token.profileImageUrl = dbUser.profileImageUrl ?? undefined;
              token.linkedStudentId = dbUser.linkedStudentId ?? undefined;
              token.name = dbUser.name;
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
};
