// ─── User Roles ───────────────────────────────────────────────────────────────
export type UserRole =
  | 'employee'
  | 'site_supervisor'
  | 'manager'
  | 'administrator'
  | 'finance';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export type AuthMethod = 'phone' | 'email';

export interface User {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  role: UserRole;
  siteId?: string;
  managerId?: string;
  createdAt: string;
  isActive: boolean;
}

// ─── Navigation Param Lists ────────────────────────────────────────────────────
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  PhoneLogin: undefined;
  OtpVerify: { phoneNumber: string; verificationId: string; isSignup?: boolean };
  Signup: undefined;
  ForgotPassword: undefined;
};

export type EmployeeTabParamList = {
  Dashboard: undefined;
  Attendance: undefined;
  Leave: undefined;
  Expenses: undefined;
  Profile: undefined;
};

export type SiteSupervisorTabParamList = {
  Dashboard: undefined;
  Employees: undefined;
  VerifyAttendance: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type ManagerTabParamList = {
  Dashboard: undefined;
  TeamAttendance: undefined;
  Expenses: undefined;
  Leave: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type AdminTabParamList = {
  Dashboard: undefined;
  Employees: undefined;
  Sites: undefined;
  Roles: undefined;
  Settings: undefined;
  Reports: undefined;
};

export type FinanceTabParamList = {
  Dashboard: undefined;
  Expenses: undefined;
  Reimbursements: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  PendingApproval: undefined;
  EmployeeApp: undefined;
  SiteSupervisorApp: undefined;
  ManagerApp: undefined;
  AdminApp: undefined;
  FinanceApp: undefined;
};
