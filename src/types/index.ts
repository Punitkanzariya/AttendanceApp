// ─── User Roles ───────────────────────────────────────────────────────────────
export type UserRole =
  | 'employee'
  | 'project_manager'
  | 'project_coordinator'
  | 'hr_manager'
  | 'administrator'
  | 'finance';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export type AuthMethod = 'phone' | 'email';

export interface LeaveBalances {
  sickLeave: number;
  paidLeave: number;
  casualLeave: number;
}

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
  panCard?: string;
  panCardPhotoUrl?: string | null;
  aadharCard?: string;
  aadharCardPhotoUrl?: string | null;
  aadharCardBackPhotoUrl?: string | null;
  photoURL?: string | null;
  leaveBalances?: LeaveBalances;
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

export type ProjectManagementTabParamList = {
  Dashboard: undefined;
  Employees: undefined;
  Expenses: undefined;
  Leave: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type ManagerTabParamList = {
  Dashboard: undefined;
  Employees: undefined;
  TeamAttendance: undefined;
  Expenses: undefined;
  Leave: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type AdminTabParamList = {
  Dashboard: undefined;
  Employees: undefined;
  Projects: undefined;
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
  ProjectManagementApp: undefined;
  ManagerApp: undefined;
  AdminApp: undefined;
  FinanceApp: undefined;
  TwoFactorOtp: undefined;
  Notifications: undefined;
};

// ─── Leave Management ────────────────────────────────────────────────────────
export type LeaveStatus = 'pending_coordinator' | 'pending_manager' | 'pending_hr' | 'pending' | 'approved' | 'rejected';

export type LeaveDurationType = 'single_day' | 'multiple_days' | 'half_day';
export type HalfDayPeriod = 'first_half' | 'second_half';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  leaveType: string;
  durationType?: LeaveDurationType;
  halfDayPeriod?: HalfDayPeriod;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  reviewedBy?: string; // UID of the manager/admin
  reviewNotes?: string;
  projectIds?: string[]; // Projects the employee was part of at the time
  coordinatorIds?: string[]; // Coordinators who need to approve
  managerIds?: string[]; // Managers who need to approve
}

// ─── Expense Management ────────────────────────────────────────────────────────
export type ExpenseStatus = 'pending_coordinator' | 'pending_manager' | 'pending_finance' | 'reimbursed' | 'rejected' | 'draft';

export interface ExpenseRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  category: string;
  amount: number;
  date: string; // ISO date
  description: string;
  status: ExpenseStatus;
  attachmentUrl?: string | null;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  projectIds?: string[];
  coordinatorIds?: string[];
  managerIds?: string[];
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
  role: string;
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

// ─── Project Management ────────────────────────────────────────────────────────

export type ProjectShift = 'Day' | 'Night';
export type ProjectType = 'Type 1' | 'Type 2' | 'Type 3';

export interface ProjectEmployee {
  employeeId: string;
  employeeName: string;
  shift: ProjectShift;
}

export interface GeoFencingConfig {
  enabled: boolean;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number; // Default 200m
}

export interface Project {
  id: string;
  projectName: string;
  projectAlias?: string;
  isClosed: boolean;
  projectManagerId?: string;
  projectManagerName?: string;
  projectCoordinatorId?: string;
  projectCoordinatorName?: string;
  siteEmployees: ProjectEmployee[];
  projectType: ProjectType;
  geoFencing: GeoFencingConfig;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface ProjectHistory {
  id: string;
  projectId: string;
  projectName: string;
  employeeId: string;
  employeeName: string;
  action: 'added' | 'removed' | 'shift_changed';
  shift?: ProjectShift;
  timestamp: string; // ISO date
  performedBy: string; // Admin UID who made the change
}
