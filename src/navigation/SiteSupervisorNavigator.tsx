import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { SiteSupervisorTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';
import PlaceholderScreen from '@/screens/main/shared/PlaceholderScreen';
import ProfileScreen from '@/screens/main/shared/ProfileScreen';
import SupervisorExpenseScreen from '@/screens/main/sitesupervisor/SupervisorExpenseScreen';
import VerifyAttendanceScreen from '@/screens/main/sitesupervisor/VerifyAttendanceScreen';
import SupervisorDashboard from '@/screens/main/sitesupervisor/SupervisorDashboard';
import SupervisorReportsScreen from '@/screens/main/sitesupervisor/SupervisorReportsScreen';

const Tab = createBottomTabNavigator<SiteSupervisorTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof SiteSupervisorTabParamList, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard:        { active: 'home',             inactive: 'home-outline'           },
  Employees:        { active: 'people',           inactive: 'people-outline'         },
  Expenses:         { active: 'receipt',          inactive: 'receipt-outline'        },
  Reports:          { active: 'bar-chart',        inactive: 'bar-chart-outline'      },
  Profile:          { active: 'person-circle',    inactive: 'person-circle-outline'  },
};

export default function SiteSupervisorNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof SiteSupervisorTabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: { borderTopColor: Colors.border, paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: FontSize.xs },
      })}
    >
      <Tab.Screen name="Dashboard" component={SupervisorDashboard} />
      <Tab.Screen name="Employees" component={VerifyAttendanceScreen} />
      <Tab.Screen name="Expenses" component={SupervisorExpenseScreen} />
      <Tab.Screen name="Reports" component={SupervisorReportsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
