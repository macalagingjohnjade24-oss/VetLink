import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MyProfileScreen } from '../screens/profile/MyProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { AccountSettingsScreen } from '../screens/profile/AccountSettingsScreen';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { PrivacySecurityScreen } from '../screens/profile/PrivacySecurityScreen';
import { HelpSupportScreen } from '../screens/profile/HelpSupportScreen';
import { AboutScreen } from '../screens/profile/AboutScreen';
import { LogoutScreen } from '../screens/profile/LogoutScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="MyProfile">
      <Stack.Screen name="MyProfile" component={MyProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Logout" component={LogoutScreen} />
    </Stack.Navigator>
  );
}
