import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, MapPin, Calendar, Receipt, CircleUser } from 'lucide-react-native';
import type { EmployeeTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';

import EmployeeDashboard from '@/screens/main/employee/EmployeeDashboard';
import EmployeeAttendanceScreen from '@/screens/main/employee/EmployeeAttendanceScreen';
import EmployeeLeaveScreen from '@/screens/main/employee/EmployeeLeaveScreen';
import EmployeeExpenseScreen from '@/screens/main/employee/EmployeeExpenseScreen';
import PlaceholderScreen from '@/screens/main/shared/PlaceholderScreen';
import ProfileScreen from '@/screens/main/shared/ProfileScreen';

const Tab = createBottomTabNavigator<EmployeeTabParamList>();

const TAB_ICONS = {
  Dashboard: House,
  Attendance: MapPin,
  Leave: Calendar,
  Expenses: Receipt,
  Profile: CircleUser,
};

export default function EmployeeNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          const Icon = TAB_ICONS[route.name as keyof EmployeeTabParamList];
          return (
            <Icon
              size={22}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          );
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: { borderTopColor: Colors.border, paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: FontSize.xs },
      })}
    >
      <Tab.Screen name="Dashboard" component={EmployeeDashboard} />
      <Tab.Screen name="Attendance" component={EmployeeAttendanceScreen} />
      <Tab.Screen name="Leave" component={EmployeeLeaveScreen} />
      <Tab.Screen name="Expenses" component={EmployeeExpenseScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
