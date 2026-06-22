src/
│
├── api/
│   ├── client.ts
│   ├── auth.api.ts
│   ├── attendance.api.ts
│   ├── leave.api.ts
│   ├── expense.api.ts
│   └── notification.api.ts
│
├── screens/
│
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   ├── OtpScreen.tsx
│   │   └── ForgotPassword.tsx
│
│   ├── attendance/
│   │   ├── AttendanceScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── AttendanceDetail.tsx
│
│   ├── leave/
│   ├── expense/
│   ├── reports/
│   ├── dashboard/
│   └── profile/
│
├── components/
│
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── Loader.tsx
│
│   ├── attendance/
│   ├── expense/
│   └── dashboard/
│
├── hooks/
│   ├── useAuth.ts
│   ├── useLocation.ts
│   ├── useNetwork.ts
│   ├── useNotification.ts
│   └── useDebounce.ts
│
├── services/
│   ├── auth.service.ts
│   ├── attendance.service.ts
│   ├── expense.service.ts
│   ├── notification.service.ts
│   ├── secureStorage.ts
│   └── geofence.service.ts
│
├── store/
│   ├── authStore.ts
│   ├── attendanceStore.ts
│   ├── expenseStore.ts
│   └── appStore.ts
│
├── validations/
│   ├── auth.validation.ts
│   ├── leave.validation.ts
│   └── expense.validation.ts
│
├── navigation/
│   ├── RootNavigator.tsx
│   ├── EmployeeNavigator.tsx
│   ├── ManagerNavigator.tsx
│   └── AdminNavigator.tsx
│
├── firebase/
│   ├── config.ts
│   ├── auth.ts
│   ├── firestore.ts
│   ├── storage.ts
│   └── messaging.ts
│
├── utils/
│   ├── date.ts
│   ├── permissions.ts
│   ├── constants.ts
│   └── helpers.ts
│
├── types/
│
├── assets/
│
└── config/
    ├── env.ts
    └── firebase.ts