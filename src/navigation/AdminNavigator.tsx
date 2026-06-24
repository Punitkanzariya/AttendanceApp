import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { AdminTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';
import PlaceholderScreen from '@/screens/main/shared/PlaceholderScreen';

import AdminEmployeesScreen from '@/screens/admin/AdminEmployeesScreen';
import AdminProjectsScreen from '@/screens/admin/AdminProjectsScreen';

import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator<AdminTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof AdminTabParamList, { active: IoniconsName; inactive: IoniconsName }> = {
  Dashboard: { active: 'home',           inactive: 'home-outline'          },
  Employees: { active: 'people',         inactive: 'people-outline'        },
  Projects:  { active: 'business',       inactive: 'business-outline'      },
  Roles:     { active: 'shield',         inactive: 'shield-outline'        },
  Settings:  { active: 'settings',       inactive: 'settings-outline'      },
  Reports:   { active: 'bar-chart',      inactive: 'bar-chart-outline'     },
};

export default function AdminNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof AdminTabParamList];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.error,
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
            iconName="shield-checkmark"
            title="Admin Dashboard"
            description="System-wide overview and controls"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Employees" component={AdminEmployeesScreen} />
      <Tab.Screen name="Projects" component={AdminProjectsScreen} />
      <Tab.Screen name="Roles">
        {() => (
          <PlaceholderScreen
            iconName="shield"
            title="Manage Roles"
            description="Assign and manage user roles"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Settings">
        {() => (
          <PlaceholderScreen
            iconName="settings"
            title="Settings"
            description="App configuration and preferences"
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Reports">
        {() => (
          <PlaceholderScreen
            iconName="bar-chart"
            title="Reports & Export"
            description="Generate reports and export data"
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
