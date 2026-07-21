// ─── Roles & Modules (from Admin Panel) ───────────────────────────────────────
export const MODULES = [
  "users",
  "employees",
  "roles",
  "projects",
  "projects_history",
  "projects_settings",
  "attendance",
  "leave",
  "expenses",
  "calendar",
  "reports",
  "audit",
  "settings"
] as const;

export type Module = typeof MODULES[number];

export interface Role {
  roleId: string;
  name: string;
  description: string;
  permissions: {
    [moduleName: string]: string[]; // e.g. "attendance": ["read", "approve"]
  };
  createdAt: string;
  createdBy: string;
}

// Legacy role for backward compatibility
export type UserRole =
  | 'employee'
  | 'project_manager'
  | 'project_coordinator'
  | 'hr_manager'
  | 'administrator'
  | 'finance'
  | string;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export type AuthMethod = 'phone' | 'email';

export interface LeaveBalances {
  [leaveTypeId: string]: number;
}

export interface UserDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  url: string;
  verified: boolean;
}

export interface User {
  uid: string;
  email: string;
  username: string;
  phoneNumber: string | null;
  displayName: string | null;
  role: UserRole; // Legacy string-based role
  roleId?: string; // New: Dynamic role ID from Admin
  roleData?: Role; // New: Hydrated role object with permissions
  
  // HR/Employee specific fields (mapped from Admin Panel)
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  designation?: string;
  department?: string;
  projectId?: string;
  joinDate?: string;
  dateOfBirth?: string;
  status?: "active" | "suspended" | "terminated";
  profilePicture?: string | null;
  currentShiftId?: string;
  panCard?: string;
  panCardPhotoUrl?: string | null;
  aadharCard?: string;
  aadharCardPhotoUrl?: string | null;
  aadharCardBackPhotoUrl?: string | null;
  
  documents?: UserDocument[];
  
  siteId?: string;
  managerId?: string;
  currentReportingManagerId?: string | null;
  
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

export type RootStackParamList = {
  Auth: undefined;
  EmployeeApp: undefined;
  Notifications: undefined;
};

export interface LeaveType {
  leaveTypeId: string;
  name: string;
  annualQuota: number;
  carryForwardMax: number;
  status: "active" | "inactive";
}

export type LeaveDurationType = "single_day" | "multiple_days" | "half_day";
export type HalfDayPeriod = "first_half" | "second_half";

export interface LeaveRequest {
  requestId: string;
  employeeId: string;
  projectId?: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  durationType?: LeaveDurationType;
  halfDayPeriod?: HalfDayPeriod;
  reason: string;
  attachmentUrl?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvers: string[];
  currentApprovalLevel: number;
  actionLogs: Array<{
    actionBy: string;
    action: string;
    timestamp: string;
  }>;
}

export interface LeaveBalance {
  balanceId: string;
  employeeId: string;
  year: number;
  casual: number;
  casualTaken: number;
  sick: number;
  sickTaken: number;
  [key: string]: any;
}

// ─── Expense Management ────────────────────────────────────────────────────────
export interface ExpenseCategory {
  categoryId: string;
  name: string;
  icon: string;
  requiresBill: boolean;
  status: "active" | "inactive";
}

export interface Expense {
  expenseId: string;
  employeeId: string;
  projectId: string;
  date: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  billUrls: string[];
  status:
    | "pending"
    | "draft"
    | "submitted"
    | "supervisor_approved"
    | "manager_approved"
    | "finance_approved"
    | "reimbursed"
    | "rejected";
  isDuplicateFlag: boolean;
  rejectionReason?: string;
  approvers?: string[];
  actionLogs: Array<{
    actionBy: string;
    action: string;
    timestamp: string;
    comments?: string;
  }>;
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
  isOutOfGeofence?: boolean;
}

export interface AttendanceRecord {
  id: string; // doc ID format: employeeId_YYYY-MM-DD
  employeeId: string;
  dateStr: string; // YYYY-MM-DD
  checkIn: AttendanceDetails | null;
  checkOut: AttendanceDetails | null;
  status: 'present' | 'absent' | 'late';
  workingHours: number; // in hours, computed on check-out
  updatedAt: string; // ISO date
  missedCheckout?: boolean;
  shift?: {
    name: string;
    startTime: string;
    endTime: string;
  };
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
  projectId: string;
  name: string;
  description: string;
  status: "active" | "completed" | "on_hold";
  image?: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  geofenceRadius: number; // In meters
  isGeofenceEnabled?: boolean;
  workingHours?: {
    start: string; // e.g. "09:00"
    end: string;   // e.g. "18:00"
  };
  availableShifts?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  }[];
  managerId?: string;
  coordinatorId?: string;
  employeeIds?: string[];
  createdAt?: string;
  updatedAt?: string;
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

export interface EmployeeAssignment {
  assignmentId: string;
  employeeId: string;
  projectId: string;
  coordinatorId: string;
  startDate: string; // ISO String
  endDate: string | null; // Null means currently active
  assignedBy: string; 
  notes?: string;
}

export interface Holiday {
  holidayId: string;
  name: string;
  date: string; // "YYYY-MM-DD"
  type: "Mandatory" | "Optional";
  applicableStates: string[] | "All";
  status: "active" | "inactive";
}

export interface CalendarEvent {
  eventId: string;
  title: string;
  description: string;
  date: string; // "YYYY-MM-DD" or ISO string
  type: "event" | "birthday" | "meeting" | "reminder";
  participants: string[];
  createdBy: string;
}

export interface SystemSettings {
  settingId: string;
  appVersion: string;
  forceUpdate: boolean;
  notificationsEnabled: boolean;
}

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "SUBMIT"
  | "EXPORT"
  | "VIEW"
  | "BULK_DELETE"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "GEOFENCE_FAILED";

export type AuditSeverity = "low" | "medium" | "high" | "critical";

export interface AuditLog {
  id: string;
  // Who
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  // What
  module: "attendance" | "leave" | "expenses" | "users" | "roles" | "projects" | "settings" | "system" | "auth";
  action: AuditAction;
  description: string;
  // Diff (before/after)
  metadata?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    changedFields?: string[];
  };
  // Device
  deviceInfo: {
    userAgent: string;
    platform: string;
    browser: string;
    os: string;
    isMobile: boolean;
  };
  // Risk
  severity: AuditSeverity;
  // Entity
  entityId?: string;
  entityName?: string;
  // Session
  sessionId?: string;
  // When
  timestamp: string;
}
