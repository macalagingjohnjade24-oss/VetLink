import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MyProfileScreen } from '../screens/profile/MyProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { AccountSettingsScreen } from '../screens/profile/AccountSettingsScreen';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { PrivacySecurityScreen } from '../screens/profile/PrivacySecurityScreen';
import { HelpSupportScreen } from '../screens/profile/HelpSupportScreen';
import { AboutScreen } from '../screens/profile/AboutScreen';
import { LogoutScreen } from '../screens/profile/LogoutScreen';
import { AIAssistantScreen } from '../screens/profile/AIAssistantScreen';
import { AISuggestedQuestionsScreen } from '../screens/profile/AISuggestedQuestionsScreen';
import { AIChatScreen } from '../screens/profile/AIChatScreen';
import { AIInquiryFormScreen } from '../screens/profile/AIInquiryFormScreen';
import { AIInquiryConfirmationScreen } from '../screens/profile/AIInquiryConfirmationScreen';
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
      <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
      <Stack.Screen name="AISuggestedQuestions" component={AISuggestedQuestionsScreen} />
      <Stack.Screen name="AIChat" component={AIChatScreen} />
      <Stack.Screen name="AIInquiryForm" component={AIInquiryFormScreen} />
      <Stack.Screen name="AIInquiryConfirmation" component={AIInquiryConfirmationScreen} />
    </Stack.Navigator>
  );
}
