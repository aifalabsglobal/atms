import { create } from 'zustand';

export type Section = 'dashboard' | 'attendance' | 'lms' | 'users' | 'violations' | 'reports' | 'geofences' | 'calendar' | 'masters' | 'settings';

export type Role = 'super_admin' | 'admin' | 'hod' | 'faculty' | 'lab_assistant' | 'student' | 'parent' | 'visitor' | 'security';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  avatar: string; // initials for avatar fallback
  profileImageUrl?: string; // Profile photo URL
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
    name: 'Dr. Ramesh Kumar',
    email: 'admin@jntuh.ac.in',
    role: 'super_admin',
    department: 'Administration',
    avatar: 'RK',
  },
  admin: {
    id: 'u2',
    name: 'Priya Sharma',
    email: 'priya.admin@jntuh.ac.in',
    role: 'admin',
    department: 'Administration',
    avatar: 'PS',
  },
  hod: {
    id: 'u5',
    name: 'Dr. Suresh Babu',
    email: 'suresh.hod@jntuh.ac.in',
    role: 'hod',
    department: 'Computer Science & Engineering',
    avatar: 'SB',
  },
  faculty: {
    id: 'u6',
    name: 'Dr. Anil Verma',
    email: 'anil.faculty@jntuh.ac.in',
    role: 'faculty',
    department: 'Computer Science & Engineering',
    avatar: 'AV',
  },
  lab_assistant: {
    id: 'u8',
    name: 'Rajesh Kumar',
    email: 'rajesh.lab@jntuh.ac.in',
    role: 'lab_assistant',
    department: 'Computer Science & Engineering',
    avatar: 'RK',
  },
  student: {
    id: 'u10',
    name: 'Arun Kumar',
    email: 'arun.student@jntuh.ac.in',
    role: 'student',
    department: 'Computer Science & Engineering',
    avatar: 'AK',
    profileImageUrl: '/profiles/student-male-1.png',
  },
  parent: {
    id: 'u18',
    name: 'Satish Reddy',
    email: 'satish.parent@jntuh.ac.in',
    role: 'parent',
    avatar: 'SR',
  },
  visitor: {
    id: 'u19',
    name: 'Meera Joshi',
    email: 'meera.visitor@jntuh.ac.in',
    role: 'visitor',
    avatar: 'MJ',
  },
  security: {
    id: 'u20',
    name: 'Ganesh Patil',
    email: 'ganesh.security@jntuh.ac.in',
    role: 'security',
    avatar: 'GP',
  },
};

// Which sidebar sections each role can access
export const ROLE_SECTIONS: Record<Role, Section[]> = {
  super_admin: ['dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar', 'settings'],
  admin: ['dashboard', 'masters', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar', 'settings'],
  hod: ['dashboard', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'calendar'],
  faculty: ['dashboard', 'attendance', 'lms', 'violations', 'reports', 'calendar'],
  lab_assistant: ['dashboard', 'attendance', 'geofences', 'calendar'],
  student: ['dashboard', 'attendance', 'lms', 'reports', 'geofences', 'calendar'],
  parent: ['dashboard', 'attendance', 'reports', 'calendar'],
  visitor: ['dashboard', 'geofences', 'calendar'],
  security: ['dashboard', 'attendance', 'violations', 'geofences', 'calendar'],
};

interface AppState {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  currentUser: CurrentUser;
  setCurrentRole: (role: Role) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  currentUser: ROLE_PRESETS.super_admin,
  setCurrentRole: (role) => set({
    currentUser: ROLE_PRESETS[role],
    activeSection: 'dashboard',
  }),
}));
