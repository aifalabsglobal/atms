import { create } from 'zustand';

export type Section = 'dashboard' | 'attendance' | 'lms' | 'users' | 'violations' | 'reports' | 'geofences' | 'settings';

export type Role = 'super_admin' | 'admin' | 'hod' | 'faculty' | 'lab_assistant' | 'student' | 'parent' | 'visitor' | 'security';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  avatar: string; // initials for avatar fallback
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
    email: 'admin@uohyd.ac.in',
    role: 'super_admin',
    department: 'IT Department',
    avatar: 'RK',
  },
  admin: {
    id: 'u2',
    name: 'Priya Sharma',
    email: 'priya.admin@uohyd.ac.in',
    role: 'admin',
    department: 'Administration',
    avatar: 'PS',
  },
  hod: {
    id: 'u5',
    name: 'Dr. Suresh Babu',
    email: 'suresh.hod@uohyd.ac.in',
    role: 'hod',
    department: 'School of Computer Science',
    avatar: 'SB',
  },
  faculty: {
    id: 'u6',
    name: 'Dr. Anil Verma',
    email: 'anil.faculty@uohyd.ac.in',
    role: 'faculty',
    department: 'School of Computer Science',
    avatar: 'AV',
  },
  lab_assistant: {
    id: 'u8',
    name: 'Rajesh Kumar',
    email: 'rajesh.lab@uohyd.ac.in',
    role: 'lab_assistant',
    department: 'School of Computer Science',
    avatar: 'RK',
  },
  student: {
    id: 'u10',
    name: 'Arun Kumar',
    email: 'arun.student@uohyd.ac.in',
    role: 'student',
    department: 'School of Computer Science',
    avatar: 'AK',
  },
  parent: {
    id: 'u18',
    name: 'Satish Reddy',
    email: 'satish.parent@uohyd.ac.in',
    role: 'parent',
    avatar: 'SR',
  },
  visitor: {
    id: 'u19',
    name: 'Meera Joshi',
    email: 'meera.visitor@uohyd.ac.in',
    role: 'visitor',
    avatar: 'MJ',
  },
  security: {
    id: 'u20',
    name: 'Ganesh Patil',
    email: 'ganesh.security@uohyd.ac.in',
    role: 'security',
    avatar: 'GP',
  },
};

// Which sidebar sections each role can access
export const ROLE_SECTIONS: Record<Role, Section[]> = {
  super_admin: ['dashboard', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'settings'],
  admin: ['dashboard', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences', 'settings'],
  hod: ['dashboard', 'attendance', 'lms', 'users', 'violations', 'reports', 'geofences'],
  faculty: ['dashboard', 'attendance', 'lms', 'violations', 'reports'],
  lab_assistant: ['dashboard', 'attendance', 'geofences'],
  student: ['dashboard', 'attendance', 'lms', 'reports'],
  parent: ['dashboard', 'attendance', 'reports'],
  visitor: ['dashboard', 'geofences'],
  security: ['dashboard', 'attendance', 'violations', 'geofences'],
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
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  currentUser: ROLE_PRESETS.super_admin,
  setCurrentRole: (role) => set({
    currentUser: ROLE_PRESETS[role],
    activeSection: 'dashboard',
  }),
}));
