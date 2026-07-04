import { create } from 'zustand';

export type Section = 'dashboard' | 'attendance' | 'lms' | 'users' | 'violations' | 'reports' | 'geofences' | 'calendar' | 'masters' | 'settings';

export type Role = 'super_admin' | 'admin' | 'hod' | 'faculty' | 'lab_assistant' | 'student' | 'parent' | 'visitor' | 'security';

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
    email: 'vice.chancellor@jntuh.ac.in',
    role: 'super_admin',
    department: 'Administration',
    avatar: 'KS',
  },
  admin: {
    id: 'u2',
    name: 'Prof. M. Manzoor Hussain',
    email: 'registrar@jntuh.ac.in',
    role: 'admin',
    department: 'Administration',
    avatar: 'MM',
  },
  hod: {
    id: 'u3',
    name: 'Dr. A. Vinaya Babu',
    email: 'hod.cse@jntuh.ac.in',
    role: 'hod',
    department: 'Computer Science & Engineering',
    avatar: 'AV',
  },
  faculty: {
    id: 'u6',
    name: 'Prof. Venkat Ramana',
    email: 'faculty.venkat@jntuh.ac.in',
    role: 'faculty',
    department: 'Computer Science & Engineering',
    avatar: 'PV',
  },
  lab_assistant: {
    id: 'u8',
    name: 'Ravi Teja K.',
    email: 'lab.ravi@jntuh.ac.in',
    role: 'lab_assistant',
    department: 'Computer Science & Engineering',
    avatar: 'RT',
  },
  student: {
    id: 'u10',
    name: 'Arun Kumar',
    email: 'student.ravi@jntuh.ac.in',
    role: 'student',
    department: 'Computer Science & Engineering',
    avatar: 'AK',
    profileImageUrl: '/profiles/student-male-1.png',
  },
  parent: {
    id: 'u18',
    name: 'Mr. Rajesh Kumar',
    email: 'parent.rajesh@jntuh.ac.in',
    role: 'parent',
    avatar: 'RK',
    linkedStudentId: 'u10',
  },
  visitor: {
    id: 'u19',
    name: 'John Smith',
    email: 'visitor.john@jntuh.ac.in',
    role: 'visitor',
    avatar: 'JS',
  },
  security: {
    id: 'u20',
    name: 'Murthy Garu',
    email: 'security.murthy@jntuh.ac.in',
    role: 'security',
    avatar: 'MG',
  },
};

export const ROLE_SECTIONS: Record<Role, Section[]> = {
  super_admin: ['dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar', 'settings'],
  admin: ['dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar', 'settings'],
  hod: ['dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar'],
  faculty: ['dashboard', 'attendance', 'lms', 'violations', 'reports', 'calendar'],
  lab_assistant: ['dashboard', 'attendance', 'geofences', 'calendar'],
  student: ['dashboard', 'attendance', 'lms', 'reports', 'geofences', 'calendar'],
  parent: ['dashboard', 'attendance', 'lms', 'reports', 'calendar'],
  visitor: ['dashboard', 'geofences', 'calendar'],
  security: ['dashboard', 'attendance', 'violations', 'geofences', 'calendar'],
};

export const GEOFENCE_WRITE_ROLES: Role[] = ['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant', 'security'];

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
  roleSwitching: string | null;
  setRoleSwitching: (label: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => {
    const user = get().currentUser;
    if (user && !ROLE_SECTIONS[user.role].includes(section)) return;
    set({ activeSection: section });
  },
  sectionContext: null,
  setSectionContext: (ctx) => set({ sectionContext: ctx }),
  navigateToSection: (section, ctx) => {
    const user = get().currentUser;
    if (user && !ROLE_SECTIONS[user.role].includes(section)) return;
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
  clearUser: () => set({ currentUser: null, activeSection: 'dashboard', sectionContext: null, roleSwitching: null }),
  roleSwitching: null,
  setRoleSwitching: (label) => set({ roleSwitching: label }),
}));
