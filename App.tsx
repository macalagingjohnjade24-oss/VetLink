import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AppProvider } from './src/context/AppContext';
import { AuthProvider } from './src/context/AuthContext';
import { BookingProvider } from './src/context/BookingContext';
import { DemoProvider, useDemo } from './src/context/DemoContext';
import { PetProvider } from './src/context/PetContext';
import { RootNavigator } from './src/navigation/RootNavigator';

void SplashScreen.preventAutoHideAsync();

/**
 * Remounting the data providers after a demo reset makes each one reload from
 * storage, which is how the seeded pets, appointments and prefs come back.
 */
function AppContent() {
  const { dataVersion } = useDemo();

  return (
    <AuthProvider key={dataVersion}>
      <AppProvider>
        <PetProvider>
          <BookingProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </BookingProvider>
        </PetProvider>
      </AppProvider>
    </AuthProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <DemoProvider>
        <AppContent />
      </DemoProvider>
    </SafeAreaProvider>
  );
}
