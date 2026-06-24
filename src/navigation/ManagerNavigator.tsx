import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ManagerTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';
import PlaceholderScreen from '@/screens/main/shared/PlaceholderScreen';
import ProfileScreen from '@/screens/main/shared/ProfileScreen';
import LeaveApprovalsScreen from '@/screens/main/manager/LeaveApprovalsScreen';
import TeamAttendanceScreen from '@/screens/main/manager/TeamAttendanceScreen';
import ManagerDashboard from '@/screens/main/manager/ManagerDashboard';
import ManagerReportsScreen from '@/screens/main/manager/ManagerReportsScreen';
import AdminEmployeesScreen from '@/screens/admin/AdminEmployeesScreen';
import { useAuthStore } from '@/store/authStore';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator<ManagerTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof ManagerTabParamList, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard:      { active: 'home',           inactive: 'home-outline'          },
  Employees:      { active: 'people',         inactive: 'people-outline'        },
  TeamAttendance: { active: 'time',           inactive: 'time-outline'          },
  Leave:          { active: 'calendar',       inactive: 'calendar-outline'      },
  Expenses:       { active: 'cash',           inactive: 'cash-outline'          },
  Reports:        { active: 'bar-chart',      inactive: 'bar-chart-outline'     },
  Profile:        { active: 'person-circle',  inactive: 'person-circle-outline' },
};

export default function ManagerNavigator() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof ManagerTabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: { 
          borderTopColor: Colors.border, 
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 8, 
          height: 60 + insets.bottom 
        },
        tabBarLabelStyle: { fontSize: FontSize.xs },
      })}
    >
      <Tab.Screen name="Dashboard" component={ManagerDashboard} />
      {user?.role === 'hr_manager' && (
        <Tab.Screen name="Employees" component={AdminEmployeesScreen} />
      )}
      <Tab.Screen name="TeamAttendance" component={TeamAttendanceScreen} options={{ tabBarLabel: 'Attendance' }} />
      <Tab.Screen name="Leave" component={LeaveApprovalsScreen} />
      <Tab.Screen name="Reports" component={ManagerReportsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
