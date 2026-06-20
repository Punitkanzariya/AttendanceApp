import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ManagerTabParamList } from '../types';
import { Colors, FontSize } from '../theme';
import PlaceholderScreen from '../screens/main/shared/PlaceholderScreen';

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
      <Tab.Screen name="Dashboard">
        {() => (
          <PlaceholderScreen
            iconName="grid"
            title="Manager Dashboard"
            description="Overview of your team"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="TeamAttendance" options={{ tabBarLabel: 'Attendance' }}>
        {() => (
          <PlaceholderScreen
            iconName="people"
            title="Team Attendance"
            description="View and manage team attendance"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Expenses">
        {() => (
          <PlaceholderScreen
            iconName="receipt"
            title="Expense Approvals"
            description="Approve or reject expense submissions"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Leave">
        {() => (
          <PlaceholderScreen
            iconName="calendar"
            title="Leave Approvals"
            description="Approve or reject leave requests"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Reports">
        {() => (
          <PlaceholderScreen
            iconName="bar-chart"
            title="Reports"
            description="Generate and view team reports"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => <PlaceholderScreen iconName="person-circle" title="My Profile" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
