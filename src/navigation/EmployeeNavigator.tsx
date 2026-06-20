import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { EmployeeTabParamList } from '../types';
import { Colors, FontSize } from '../theme';

import EmployeeDashboard from '../screens/main/employee/EmployeeDashboard';
import PlaceholderScreen from '../screens/main/shared/PlaceholderScreen';

const Tab = createBottomTabNavigator<EmployeeTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof EmployeeTabParamList, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard:  { active: 'home',              inactive: 'home-outline'           },
  Attendance: { active: 'location',          inactive: 'location-outline'       },
  Leave:      { active: 'calendar',          inactive: 'calendar-outline'       },
  Expenses:   { active: 'receipt',           inactive: 'receipt-outline'        },
  Profile:    { active: 'person-circle',     inactive: 'person-circle-outline'  },
};

export default function EmployeeNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof EmployeeTabParamList];
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size}
              color={color}
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
      <Tab.Screen name="Attendance">
        {() => (
          <PlaceholderScreen
            iconName="location"
            title="Mark Attendance"
            description="Location-based attendance marking coming soon"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Leave">
        {() => (
          <PlaceholderScreen
            iconName="calendar"
            title="Leave Management"
            description="Apply and track your leave requests"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Expenses">
        {() => (
          <PlaceholderScreen
            iconName="receipt"
            title="Expense Submission"
            description="Submit expenses and upload bills"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => (
          <PlaceholderScreen
            iconName="person-circle"
            title="My Profile"
            description="View and update your profile"
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
