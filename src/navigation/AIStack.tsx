import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import type { AIStackParamList } from './types';
import { AIAssistantScreen } from '../screens/profile/AIAssistantScreen';
import { AISuggestedQuestionsScreen } from '../screens/profile/AISuggestedQuestionsScreen';
import { AIChatScreen } from '../screens/profile/AIChatScreen';
import { AIInquiryFormScreen } from '../screens/profile/AIInquiryFormScreen';
import { AIInquiryConfirmationScreen } from '../screens/profile/AIInquiryConfirmationScreen';

const Stack = createNativeStackNavigator<AIStackParamList>();

/**
 * The assistant flow sits above the tab navigator, so no tab is highlighted while the owner is here.
 * It is reachable from Home and from Help and Support.
 */
export function AIStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
      <Stack.Screen name="AISuggestedQuestions" component={AISuggestedQuestionsScreen} />
      <Stack.Screen name="AIChat" component={AIChatScreen} />
      <Stack.Screen name="AIInquiryForm" component={AIInquiryFormScreen} />
      <Stack.Screen name="AIInquiryConfirmation" component={AIInquiryConfirmationScreen} />
    </Stack.Navigator>
  );
}
