import { create } from 'zustand';

export type Section = 'dashboard' | 'attendance' | 'lms' | 'users' | 'violations' | 'reports' | 'geofences' | 'settings';

interface AppState {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  currentUser: string;
  setCurrentUser: (user: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  currentUser: 'admin',
  setCurrentUser: (user) => set({ currentUser: user }),
}));
