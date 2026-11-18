import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import type { HomeStackParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { NotificationDetailsScreen } from '../screens/notifications/NotificationDetailsScreen';
import { GlobalSearchScreen } from '../screens/search/GlobalSearchScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationDetails" component={NotificationDetailsScreen} />
      <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} />
    </Stack.Navigator>
  );
}
