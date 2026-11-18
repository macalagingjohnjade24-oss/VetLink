import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily } from '../theme';
import type { TabParamList } from './types';
import { HomeStackNavigator } from './HomeStack';
import { ClinicsStackNavigator } from './ClinicsStack';
import { BookingsStackNavigator } from './BookingsStack';
import { PetsStackNavigator } from './PetsStack';
import { ProfileStackNavigator } from './ProfileStack';

const Tab = createBottomTabNavigator<TabParamList>();

const iconFor = (route: keyof TabParamList): { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap } => {
  switch (route) {
    case 'HomeTab':
      return { active: 'home', inactive: 'home-outline' };
    case 'ClinicsTab':
      return { active: 'location', inactive: 'location-outline' };
    case 'BookingsTab':
      return { active: 'calendar', inactive: 'calendar-outline' };
    case 'PetsTab':
      return { active: 'paw', inactive: 'paw-outline' };
    default:
      return { active: 'person', inactive: 'person-outline' };
  }
};

export function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.text.brand,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 10, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface.background,
          borderTopColor: colors.surface.border,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          height: 64 + insets.bottom,
        },
        tabBarIcon: ({ focused, color }) => {
          const icons = iconFor(route.name);
          return <Ionicons name={focused ? icons.active : icons.inactive} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="ClinicsTab" component={ClinicsStackNavigator} options={{ tabBarLabel: 'Clinics' }} />
      <Tab.Screen name="BookingsTab" component={BookingsStackNavigator} options={{ tabBarLabel: 'Bookings' }} />
      <Tab.Screen name="PetsTab" component={PetsStackNavigator} options={{ tabBarLabel: 'My Pets' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
