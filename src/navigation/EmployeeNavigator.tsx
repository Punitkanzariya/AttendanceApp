import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, ClipboardCheck, CalendarRange, IndianRupee, CircleUser } from 'lucide-react-native';
import type { EmployeeTabParamList } from '@/types';
import { Colors, FontSize } from '@/theme';

import EmployeeDashboard from '@/screens/main/employee/EmployeeDashboard';
import EmployeeAttendanceScreen from '@/screens/main/employee/EmployeeAttendanceScreen';
import EmployeeLeaveScreen from '@/screens/main/employee/EmployeeLeaveScreen';
import EmployeeExpenseScreen from '@/screens/main/employee/EmployeeExpenseScreen';
import PlaceholderScreen from '@/screens/main/shared/PlaceholderScreen';
import ProfileScreen from '@/screens/main/shared/ProfileScreen';

import { Platform, View, TouchableOpacity, Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';

const Tab = createBottomTabNavigator<EmployeeTabParamList>();

const TAB_ICONS = {
  Dashboard: House,
  Attendance: ClipboardCheck,
  Leave: CalendarRange,
  Expenses: IndianRupee,
  Profile: CircleUser,
};

function CustomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps & { insets: any }) {
  const [tabWidth, setTabWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tabWidth > 0) {
      Animated.timing(slideAnim, {
        toValue: state.index * tabWidth,
        useNativeDriver: true,
        duration: 250,
      }).start();
    }
  }, [state.index, tabWidth, slideAnim]);

  return (
    <View style={[styles.bottomFixedSection, { paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 8, height: 60 + insets.bottom }]}>
      <View 
        style={styles.gridContainer}
        onLayout={(e) => {
          setTabWidth(e.nativeEvent.layout.width / state.routes.length);
        }}
      >
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.slider,
              {
                width: tabWidth - 6, // 3px margin on each side
                transform: [{ translateX: slideAnim }, { translateX: 3 }],
              },
            ]}
          />
        )}
        
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const Icon = TAB_ICONS[route.name as keyof EmployeeTabParamList];
          const color = isFocused ? Colors.primary : Colors.text.tertiary;

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.8}
              onPress={onPress}
              style={styles.tabItem}
            >
              <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 2} />
              <Text style={[styles.tabLabel, { color }]}>
                {options.title !== undefined ? options.title : route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function EmployeeNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} insets={insets} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={EmployeeDashboard} />
      <Tab.Screen name="Attendance" component={EmployeeAttendanceScreen} />
      <Tab.Screen name="Leave" component={EmployeeLeaveScreen} />
      <Tab.Screen name="Expenses" component={EmployeeExpenseScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bottomFixedSection: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    width: '100%',
  },
  gridContainer: {
    flexDirection: 'row',
    position: 'relative',
    height: 60,
    width: '100%',
  },
  slider: {
    position: 'absolute',
    top: 6,
    left: 0,
    height: 48,
    backgroundColor: Colors.primary + '15',
    borderRadius: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    height: 60,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
});
