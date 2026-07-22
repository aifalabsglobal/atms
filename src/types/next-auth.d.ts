import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/store';

export type AuthSurface = 'campus' | 'knuct';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      department?: string;
      profileImageUrl?: string;
      linkedStudentId?: string;
      avatar: string;
      authSurface: AuthSurface;
      knuctConsoleAccess: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    role: Role;
    department?: string;
    profileImageUrl?: string;
    linkedStudentId?: string;
    authSurface?: AuthSurface;
    knuctConsoleAccess?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    department?: string;
    profileImageUrl?: string;
    linkedStudentId?: string;
    authSurface?: AuthSurface;
    knuctConsoleAccess?: boolean;
    active?: boolean;
    refreshedAt?: number;
  }
}
