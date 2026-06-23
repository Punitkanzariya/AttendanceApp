import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { User, UserRole } from '@/types';

const SESSION_KEY = 'attendance_session';

// Cross-platform storage: AsyncStorage on mobile, localStorage on Web
const Storage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await AsyncStorage.removeItem(key);
  }
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOtpVerified: boolean;

  // Actions
  setUser: (user: User | null) => void;
  updateUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  verifyLoginOtp: () => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  persistSession: (user: User, otpVerified?: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isOtpVerified: false,

  setUser: (user) =>
    set({ user, isAuthenticated: !!user, isLoading: false, isOtpVerified: false }), // Reset OTP on direct setUser

  updateUser: (user) =>
    set((state) => ({ user, isAuthenticated: state.isAuthenticated, isOtpVerified: state.isOtpVerified })),

  setLoading: (isLoading) => set({ isLoading }),

  verifyLoginOtp: () => set({ isOtpVerified: true }),

  logout: async () => {
    await Storage.removeItem(SESSION_KEY);
    set({ user: null, isAuthenticated: false, isOtpVerified: false, isLoading: false });
  },

  persistSession: async (user: User, otpVerified: boolean = false) => {
    await Storage.setItem(SESSION_KEY, JSON.stringify({ user, otpVerified }));
    set({ user, isAuthenticated: true, isOtpVerified: otpVerified, isLoading: false });
  },

  restoreSession: async () => {
    try {
      const raw = await Storage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Fallback for older sessions that were just the user object
        if (parsed.user) {
          set({ user: parsed.user as User, isAuthenticated: true, isOtpVerified: !!parsed.otpVerified, isLoading: false });
        } else {
          set({ user: parsed as User, isAuthenticated: true, isOtpVerified: true, isLoading: false });
        }
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
