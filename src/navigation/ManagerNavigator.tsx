import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ManagerTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';
import PlaceholderScreen from '@/screens/main/shared/PlaceholderScreen';
import ProfileScreen from '@/screens/main/shared/ProfileScreen';
import LeaveApprovalsScreen from '@/screens/main/manager/LeaveApprovalsScreen';
import ExpenseApprovalsScreen from '@/screens/main/manager/ExpenseApprovalsScreen';
import TeamAttendanceScreen from '@/screens/main/manager/TeamAttendanceScreen';
import ManagerDashboard from '@/screens/main/manager/ManagerDashboard';
import ManagerReportsScreen from '@/screens/main/manager/ManagerReportsScreen';

const Tab = createBottomTabNavigator<ManagerTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof ManagerTabParamList, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard:      { active: 'home',           inactive: 'home-outline'          },
  TeamAttendance: { active: 'people',         inactive: 'people-outline'        },
  Expenses:       { active: 'receipt',        inactive: 'receipt-outline'       },
  Leave:          { active: 'calendar',       inactive: 'calendar-outline'      },
  Reports:        { active: 'bar-chart',      inactive: 'bar-chart-outline'     },
  Profile:        { active: 'person-circle',  inactive: 'person-circle-outline' },
};

export default function ManagerNavigator() {
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
        tabBarStyle: { borderTopColor: Colors.border, paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: FontSize.xs },
      })}
    >
      <Tab.Screen name="Dashboard" component={ManagerDashboard} />
      <Tab.Screen name="TeamAttendance" component={TeamAttendanceScreen} options={{ tabBarLabel: 'Attendance' }} />
      <Tab.Screen name="Expenses" component={ExpenseApprovalsScreen} />
      <Tab.Screen name="Leave" component={LeaveApprovalsScreen} />
      <Tab.Screen name="Reports" component={ManagerReportsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
