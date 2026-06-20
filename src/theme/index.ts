export const Colors = {
  primary: '#2563EB',       // Blue-600
  primaryDark: '#1D4ED8',   // Blue-700
  primaryLight: '#EFF6FF',  // Blue-50
  secondary: '#7C3AED',     // Violet-600
  accent: '#059669',        // Emerald-600

  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#0284C7',

  white: '#FFFFFF',
  black: '#0F172A',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#F1F5F9',

  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#94A3B8',
    inverse: '#FFFFFF',
    link: '#2563EB',
  },

  // Role-based colors
  role: {
    employee: '#2563EB',
    site_supervisor: '#059669',
    manager: '#7C3AED',
    administrator: '#DC2626',
    finance: '#D97706',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
