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
  
  // App-wide pre-fetched data
  projectData?: {
    assignedProject?: string | null;
    assignedShift?: string | null;
    assignedShiftName?: string | null;
    projectManager?: string | null;
    projectCoordinator?: string | null;
  };
  setProjectData: (data: any) => void;
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

  setProjectData: (data) => set({ projectData: data }),

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

export const hasPermission = (user: User | null, moduleName: string, action: string = 'read'): boolean => {
  if (!user) return false;

  // 1. Dynamic permission check
  if (user.roleData && user.roleData.permissions && user.roleData.permissions[moduleName]) {
    return user.roleData.permissions[moduleName].includes(action);
  }

  // 2. Legacy fallback if roleData is missing (for transition)
  if (user.role === 'administrator') return true;
  if (user.role === 'employee') {
    const legacyModules = ['attendance', 'leave', 'expenses', 'profile'];
    if (legacyModules.includes(moduleName)) return true;
  }
  if (user.role === 'hr_manager') {
    const legacyModules = ['employees', 'roles', 'profile'];
    if (legacyModules.includes(moduleName)) return true;
  }

  return false;
};
