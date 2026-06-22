import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { SiteSupervisorTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';
import PlaceholderScreen from '@/screens/main/shared/PlaceholderScreen';
import ProfileScreen from '@/screens/main/shared/ProfileScreen';
import SupervisorExpenseScreen from '@/screens/main/sitesupervisor/SupervisorExpenseScreen';

const Tab = createBottomTabNavigator<SiteSupervisorTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof SiteSupervisorTabParamList, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard:        { active: 'home',             inactive: 'home-outline'           },
  Employees:        { active: 'people',           inactive: 'people-outline'         },
  VerifyAttendance: { active: 'checkmark-circle', inactive: 'checkmark-circle-outline' },
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
      <Tab.Screen name="Dashboard">
        {() => (
          <PlaceholderScreen
            iconName="business"
            title="Supervisor Dashboard"
            description="Overview of your site and team"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Employees">
        {() => (
          <PlaceholderScreen
            iconName="people"
            title="Assigned Employees"
            description="View and manage your team members"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="VerifyAttendance" options={{ tabBarLabel: 'Verify' }}>
        {() => (
          <PlaceholderScreen
            iconName="checkmark-circle"
            title="Verify Attendance"
            description="Review and verify employee attendance"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Expenses" component={SupervisorExpenseScreen} />
      <Tab.Screen name="Reports">
        {() => (
          <PlaceholderScreen
            iconName="bar-chart"
            title="Site Reports"
            description="View reports for your site"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
