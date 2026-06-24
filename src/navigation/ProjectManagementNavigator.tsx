import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ProjectManagementTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';
import ProfileScreen from '@/screens/main/shared/ProfileScreen';
import ProjectExpenseScreen from '@/screens/main/project_management/ProjectExpenseScreen';
import TeamAttendanceScreen from '@/screens/main/manager/TeamAttendanceScreen';
import ProjectDashboard from '@/screens/main/project_management/ProjectDashboard';
import ProjectReportsScreen from '@/screens/main/project_management/ProjectReportsScreen';
import LeaveApprovalsScreen from '@/screens/main/manager/LeaveApprovalsScreen';

import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator<ProjectManagementTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof ProjectManagementTabParamList, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard:        { active: 'grid',             inactive: 'grid-outline'           },
  Employees:        { active: 'people',           inactive: 'people-outline'         },
  Expenses:         { active: 'wallet',           inactive: 'wallet-outline'         },
  Leave:            { active: 'calendar',         inactive: 'calendar-outline'       },
  Reports:          { active: 'bar-chart',        inactive: 'bar-chart-outline'      },
  Profile:          { active: 'person',           inactive: 'person-outline'         },
};

export default function ProjectManagementNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof ProjectManagementTabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: { 
          borderTopColor: Colors.border, 
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 8, 
          height: 60 + insets.bottom 
        },
        tabBarLabelStyle: { fontSize: FontSize.xs },
      })}
    >
      <Tab.Screen name="Dashboard" component={ProjectDashboard} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Employees" component={TeamAttendanceScreen} options={{ tabBarLabel: 'Employees' }} />
      <Tab.Screen name="Expenses" component={ProjectExpenseScreen} options={{ tabBarLabel: 'Expenses' }} />
      <Tab.Screen name="Leave" component={LeaveApprovalsScreen} options={{ tabBarLabel: 'Leave' }} />
      <Tab.Screen name="Reports" component={ProjectReportsScreen} options={{ tabBarLabel: 'Reports' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
