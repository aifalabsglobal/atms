import { create } from 'zustand';
import { ALL_SECTIONS, DEFAULT_ROLE_SECTIONS } from '@/lib/rbac-defaults';
import { STAFF_ROLES } from '@/lib/user-management';
import type { Role, Section } from '@/lib/roles';

export type { Role, Section } from '@/lib/roles';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  avatar: string;
  profileImageUrl?: string;
  linkedStudentId?: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  hod: 'Head of Department',
  faculty: 'Faculty',
  lab_assistant: 'Lab Assistant',
  student: 'Student',
  parent: 'Parent',
  visitor: 'Visitor',
  security: 'Security',
};

export const ROLE_PRESETS: Record<Role, CurrentUser> = {
  super_admin: {
    id: 'u1',
    name: 'Dr. K. Sreenivasa Raju',
    email: 'vice.chancellor@aimscs.ac.in',
    role: 'super_admin',
    department: 'Administration',
    avatar: 'KS',
  },
  admin: {
    id: 'u2',
    name: 'Prof. M. Manzoor Hussain',
    email: 'registrar@aimscs.ac.in',
    role: 'admin',
    department: 'Administration',
    avatar: 'MM',
  },
  hod: {
    id: 'u3',
    name: 'Dr. A. Vinaya Babu',
    email: 'hod.cse@aimscs.ac.in',
    role: 'hod',
    department: 'Computer Science & Engineering',
    avatar: 'AV',
  },
  faculty: {
    id: 'u6',
    name: 'Prof. Venkat Ramana',
    email: 'faculty.venkat@aimscs.ac.in',
    role: 'faculty',
    department: 'Computer Science & Engineering',
    avatar: 'PV',
  },
  lab_assistant: {
    id: 'u8',
    name: 'Ravi Teja K.',
    email: 'lab.ravi@aimscs.ac.in',
    role: 'lab_assistant',
    department: 'Computer Science & Engineering',
    avatar: 'RT',
  },
  student: {
    id: 'u10',
    name: 'Arun Kumar',
    email: 'student.ravi@aimscs.ac.in',
    role: 'student',
    department: 'Computer Science & Engineering',
    avatar: 'AK',
    profileImageUrl: '/profiles/student-male-1.png',
  },
  parent: {
    id: 'u18',
    name: 'Mr. Rajesh Kumar',
    email: 'parent.rajesh@aimscs.ac.in',
    role: 'parent',
    avatar: 'RK',
    linkedStudentId: 'u10',
  },
  visitor: {
    id: 'u19',
    name: 'John Smith',
    email: 'visitor.john@aimscs.ac.in',
    role: 'visitor',
    avatar: 'JS',
  },
  security: {
    id: 'u20',
    name: 'Murthy Garu',
    email: 'security.murthy@aimscs.ac.in',
    role: 'security',
    avatar: 'MG',
  },
};

/** @deprecated Prefer useRoleSections() or roleSections from store — defaults only. */
export const ROLE_SECTIONS = DEFAULT_ROLE_SECTIONS;
export { DEFAULT_ROLE_SECTIONS };

export function resolveRoleSections(matrix: Record<Role, Section[]> | null | undefined): Record<Role, Section[]> {
  return matrix ?? DEFAULT_ROLE_SECTIONS;
}

export const GEOFENCE_WRITE_ROLES: Role[] = ['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant', 'security'];
export const TIMETABLE_WRITE_ROLES: Role[] = ['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant'];
export const LMS_WRITE_ROLES: Role[] = ['super_admin', 'admin', 'faculty', 'lab_assistant'];
export const MASTERS_WRITE_ROLES: Role[] = ['super_admin', 'admin'];
export { STAFF_ROLES };

export const ROLE_COLORS: Record<Role, string> = {
  super_admin: '#1A3C6E',
  admin: '#2C5F8A',
  hod: '#1B6B4A',
  faculty: '#7C3AED',
  lab_assistant: '#B45309',
  student: '#0E7490',
  parent: '#BE185D',
  visitor: '#6B7280',
  security: '#991B1B',
};

export type SectionContext = {
  usersQuery?: string;
  usersSelectedId?: string;
  lmsTab?: string;
  lmsCourseId?: string;
  attendanceSessionId?: string;
  attendanceTab?: 'sessions' | 'timetable' | 'condonation' | 'mark' | 'history';
  settingsTab?: string;
  /** Pre-select user in Settings → RBAC per-user overrides. */
  rbacUserId?: string;
};

interface AppState {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  sectionContext: SectionContext | null;
  setSectionContext: (ctx: SectionContext | null) => void;
  navigateToSection: (section: Section, ctx?: SectionContext) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  clearUser: () => void;
  roleSections: Record<Role, Section[]> | null;
  setRoleSections: (matrix: Record<Role, Section[]> | null) => void;
  userEffectiveSections: Section[] | null;
  setUserEffectiveSections: (sections: Section[] | null) => void;
  roleSwitching: string | null;
  setRoleSwitching: (label: string | null) => void;
}

function sectionsForUser(
  user: CurrentUser | null,
  roleSections: Record<Role, Section[]> | null,
  userEffectiveSections: Section[] | null,
): Section[] {
  if (userEffectiveSections?.length) return userEffectiveSections;
  if (!user) return ['dashboard'];
  const matrix = resolveRoleSections(roleSections);
  return matrix[user.role] ?? DEFAULT_ROLE_SECTIONS[user.role] ?? ['dashboard'];
}

export const useAppStore = create<AppState>((set, get) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => {
    const user = get().currentUser;
    const allowed = sectionsForUser(user, get().roleSections, get().userEffectiveSections);
    if (user && !allowed.includes(section)) return;
    set({ activeSection: section });
  },
  sectionContext: null,
  setSectionContext: (ctx) => set({ sectionContext: ctx }),
  navigateToSection: (section, ctx) => {
    const user = get().currentUser;
    const allowed = sectionsForUser(user, get().roleSections, get().userEffectiveSections);
    if (user && !allowed.includes(section)) return;
    set({ activeSection: section, sectionContext: ctx ?? null });
  },
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  currentUser: null,
  setCurrentUser: (user) => {
    if (!user) {
      set({ currentUser: null });
      return;
    }
    const prev = get().currentUser;
    const roleChanged = prev?.id !== user.id;
    set({
      currentUser: user,
      ...(roleChanged ? { activeSection: 'dashboard' as Section } : {}),
    });
  },
  clearUser: () =>
    set({
      currentUser: null,
      activeSection: 'dashboard',
      sectionContext: null,
      roleSwitching: null,
      roleSections: null,
      userEffectiveSections: null,
    }),
  roleSections: null,
  setRoleSections: (matrix) => set({ roleSections: matrix }),
  userEffectiveSections: null,
  setUserEffectiveSections: (sections) => set({ userEffectiveSections: sections }),
  roleSwitching: null,
  setRoleSwitching: (label) => set({ roleSwitching: label }),
}));

export function useRoleSections(): Record<Role, Section[]> {
  const matrix = useAppStore((s) => s.roleSections);
  return resolveRoleSections(matrix);
}

/** Effective nav sections for the logged-in user (role matrix + user overrides). */
export function useEffectiveSections(): Section[] {
  const user = useAppStore((s) => s.currentUser);
  const userEffective = useAppStore((s) => s.userEffectiveSections);
  const roleMatrix = useRoleSections();
  if (user?.role === 'super_admin') return [...ALL_SECTIONS];
  if (userEffective?.length) return userEffective;
  if (user) return roleMatrix[user.role] ?? DEFAULT_ROLE_SECTIONS[user.role] ?? ['dashboard'];
  return ['dashboard'];
}

export function useSectionAccess(section: Section): boolean {
  const user = useAppStore((s) => s.currentUser);
  if (user?.role === 'super_admin') return true;
  const sections = useEffectiveSections();
  return sections.includes(section);
}

/** Section RBAC + role capability (e.g. HOD has masters section but read-only). */
export function useSectionWrite(section: Section, writeRoles: Role[]): boolean {
  const user = useAppStore((s) => s.currentUser);
  if (user?.role === 'super_admin') return true;
  const sections = useEffectiveSections();
  if (!user) return false;
  return sections.includes(section) && writeRoles.includes(user.role);
}

export function useCanEditCalendar(): boolean {
  return useSectionWrite('calendar', STAFF_ROLES);
}

export function useCanWriteMasters(): boolean {
  return useSectionWrite('masters', MASTERS_WRITE_ROLES);
}

export function useIsMastersReadOnly(): boolean {
  const user = useAppStore((s) => s.currentUser);
  if (user?.role === 'super_admin') return false;
  const sections = useEffectiveSections();
  if (!user || !sections.includes('masters')) return true;
  return user.role === 'hod' || !MASTERS_WRITE_ROLES.includes(user.role);
}

export function useCanManageTimetable(): boolean {
  const user = useAppStore((s) => s.currentUser);
  if (user?.role === 'super_admin') return true;
  const sections = useEffectiveSections();
  if (!user) return false;
  const hasScope = sections.includes('attendance') || sections.includes('masters');
  return hasScope && TIMETABLE_WRITE_ROLES.includes(user.role);
}

export function useCanWriteLms(): boolean {
  return useSectionWrite('lms', LMS_WRITE_ROLES);
}

export function useCanViewLmsRoster(): boolean {
  const user = useAppStore((s) => s.currentUser);
  if (user?.role === 'super_admin') return true;
  const sections = useEffectiveSections();
  if (!user || !sections.includes('lms')) return false;
  return user.role === 'hod' || LMS_WRITE_ROLES.includes(user.role);
}

export function useCanStaffAttendance(): boolean {
  return useSectionWrite('attendance', STAFF_ROLES);
}
