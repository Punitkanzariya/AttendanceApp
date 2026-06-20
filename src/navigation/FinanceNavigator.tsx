import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { FinanceTabParamList } from '../types';
import { Colors, FontSize } from '../theme';
import PlaceholderScreen from '../screens/main/shared/PlaceholderScreen';

const Tab = createBottomTabNavigator<FinanceTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof FinanceTabParamList, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard:       { active: 'home',          inactive: 'home-outline'         },
  Expenses:        { active: 'receipt',       inactive: 'receipt-outline'      },
  Reimbursements:  { active: 'cash',          inactive: 'cash-outline'         },
  Reports:         { active: 'bar-chart',     inactive: 'bar-chart-outline'    },
  Profile:         { active: 'person-circle', inactive: 'person-circle-outline'},
};

export default function FinanceNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof FinanceTabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.warning,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: { borderTopColor: Colors.border, paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: FontSize.xs },
      })}
    >
      <Tab.Screen name="Dashboard">
        {() => (
          <PlaceholderScreen
            iconName="wallet"
            title="Finance Dashboard"
            description="Expense overview and pending actions"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Expenses">
        {() => (
          <PlaceholderScreen
            iconName="receipt"
            title="Verify Expenses"
            description="Review and verify submitted expenses"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Reimbursements">
        {() => (
          <PlaceholderScreen
            iconName="cash"
            title="Reimbursements"
            description="Process approved reimbursements"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Reports">
        {() => (
          <PlaceholderScreen
            iconName="bar-chart"
            title="Accounting Reports"
            description="Export accounting and financial reports"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => <PlaceholderScreen iconName="person-circle" title="My Profile" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
