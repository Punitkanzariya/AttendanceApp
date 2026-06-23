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
  email: string;
  username: string;
  phoneNumber: string | null;
  displayName: string | null;
  role: UserRole;
  siteId?: string;
  managerId?: string;
  dateOfBirth?: string;
  employeeId?: string;
  photoURL?: string | null;
  createdAt: string;
  isActive: boolean;
}

// ─── Navigation Param Lists ────────────────────────────────────────────────────
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  PhoneLogin: undefined;
  OtpVerify: { phoneNumber: string; verificationId: string; isSignup?: boolean };
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
  Expenses: undefined;
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
  TwoFactorOtp: undefined;
  Notifications: undefined;
};


// ─── Leave Management ────────────────────────────────────────────────────────
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  reviewedBy?: string; // UID of the manager/admin
  reviewNotes?: string;
}

// ─── Expense Management ────────────────────────────────────────────────────────
export type ExpenseStatus = 'pending_supervisor' | 'pending_manager' | 'pending_finance' | 'reimbursed' | 'rejected' | 'draft';

export interface ExpenseRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  amount: number;
  date: string; // ISO date
  description: string;
  status: ExpenseStatus;
  attachmentUrl?: string | null;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  reviewedBy?: string; // UID of the manager/finance
  rejectionReason?: string;
}

// ─── Attendance Management ───────────────────────────────────────────────────
export interface AttendanceLocation {
  latitude: number;
  longitude: number;
  address: string;
}

export interface AttendanceDetails {
  timestamp: string; // ISO date
  location: AttendanceLocation | null;
  remark?: string;
  deviceInfo?: string;
  selfieUrl?: string | null;
}

export interface AttendanceRecord {
  id: string; // doc ID format: employeeId_YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  employeeEmail?: string | null;
  dateStr: string; // YYYY-MM-DD
  checkIn: AttendanceDetails | null;
  checkOut: AttendanceDetails | null;
  status: 'present' | 'absent' | 'late';
  workingHours: number; // in hours, computed on check-out
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  updatedAt: string; // ISO date
}
