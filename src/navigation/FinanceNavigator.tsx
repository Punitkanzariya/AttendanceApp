import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { FinanceTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';
import PlaceholderScreen from '@/screens/main/shared/PlaceholderScreen';
import ProfileScreen from '@/screens/main/shared/ProfileScreen';
import FinanceExpenseScreen from '@/screens/main/finance/FinanceExpenseScreen';
import ReimbursementsScreen from '@/screens/main/finance/ReimbursementsScreen';

import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
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
        tabBarStyle: { 
          borderTopColor: Colors.border, 
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 8, 
          height: 60 + insets.bottom 
        },
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
      <Tab.Screen name="Expenses" component={FinanceExpenseScreen} />
      <Tab.Screen name="Reimbursements" component={ReimbursementsScreen} />
      <Tab.Screen name="Reports">
        {() => (
          <PlaceholderScreen
            iconName="bar-chart"
            title="Accounting Reports"
            description="Export accounting and financial reports"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
