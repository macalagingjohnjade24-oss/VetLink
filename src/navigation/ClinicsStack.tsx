import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import type { ClinicsStackParamList } from './types';
import { ClinicDiscoveryScreen } from '../screens/clinics/ClinicDiscoveryScreen';
import { ClinicSearchResultsScreen } from '../screens/clinics/ClinicSearchResultsScreen';
import { MapViewScreen } from '../screens/clinics/MapViewScreen';
import { FilterSortScreen } from '../screens/clinics/FilterSortScreen';
import { ClinicDetailsScreen } from '../screens/clinics/ClinicDetailsScreen';
import { ClinicServicesScreen } from '../screens/clinics/ClinicServicesScreen';
import { ServiceDetailsScreen } from '../screens/clinics/ServiceDetailsScreen';
import { ClinicContactScreen } from '../screens/clinics/ClinicContactScreen';

const Stack = createNativeStackNavigator<ClinicsStackParamList>();

export function ClinicsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ClinicDiscovery" component={ClinicDiscoveryScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="ClinicSearchResults" component={ClinicSearchResultsScreen} />
      <Stack.Screen name="MapView" component={MapViewScreen} />
      <Stack.Screen name="FilterSort" component={FilterSortScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="ClinicDetails" component={ClinicDetailsScreen} />
      <Stack.Screen name="ClinicServices" component={ClinicServicesScreen} />
      <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
      <Stack.Screen name="ClinicContact" component={ClinicContactScreen} />
    </Stack.Navigator>
  );
}
