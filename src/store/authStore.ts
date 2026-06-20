import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { User, UserRole } from '../types';

const SESSION_KEY = 'attendance_session';

// Cross-platform storage: SecureStore on mobile, localStorage on Web
const Storage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  }
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  persistSession: (user: User) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    await Storage.removeItem(SESSION_KEY);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  persistSession: async (user: User) => {
    await Storage.setItem(SESSION_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true, isLoading: false });
  },

  restoreSession: async () => {
    try {
      const raw = await Storage.getItem(SESSION_KEY);
      if (raw) {
        const user: User = JSON.parse(raw);
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));

// Role permission helpers
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  employee: [
    'mark_attendance',
    'apply_leave',
    'view_attendance_history',
    'submit_expenses',
    'upload_bills',
    'view_expense_status',
  ],
  site_supervisor: [
    'view_assigned_employees',
    'verify_attendance',
    'approve_expenses_level1',
    'view_site_reports',
  ],
  manager: [
    'approve_expenses',
    'reject_expenses',
    'approve_leave',
    'view_team_attendance',
    'generate_reports',
  ],
  administrator: [
    'manage_employees',
    'manage_sites',
    'manage_roles',
    'configure_settings',
    'generate_reports',
    'export_data',
  ],
  finance: [
    'verify_expenses',
    'process_reimbursements',
    'export_accounting_reports',
  ],
};

export const hasPermission = (role: UserRole, permission: string): boolean =>
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
