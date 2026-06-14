import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/store';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      department?: string;
      profileImageUrl?: string;
      linkedStudentId?: string;
      avatar: string;
    } & DefaultSession['user'];
  }

  interface User {
    role: Role;
    department?: string;
    profileImageUrl?: string;
    linkedStudentId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    department?: string;
    profileImageUrl?: string;
    linkedStudentId?: string;
  }
}
