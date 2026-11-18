import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MyPetsScreen } from '../screens/pets/MyPetsScreen';
import { PetDetailsScreen } from '../screens/pets/PetDetailsScreen';
import { PetFormScreen } from '../screens/pets/PetFormScreen';
import { PetPhotoScreen } from '../screens/pets/PetPhotoScreen';
import { VaccinationRecordsScreen } from '../screens/pets/VaccinationRecordsScreen';
import { VaccinationDetailsScreen } from '../screens/pets/VaccinationDetailsScreen';
import { UpcomingVaccinationsScreen } from '../screens/pets/UpcomingVaccinationsScreen';
import { HealthRecordsScreen } from '../screens/pets/HealthRecordsScreen';
import { MedicalHistoryScreen } from '../screens/pets/MedicalHistoryScreen';
import { MedicalRecordDetailsScreen } from '../screens/pets/MedicalRecordDetailsScreen';
import { AppointmentHistoryScreen } from '../screens/pets/AppointmentHistoryScreen';
import { MedicalRecordAttachmentsScreen } from '../screens/pets/MedicalRecordAttachmentsScreen';
import type { PetsStackParamList } from './types';

const Stack = createNativeStackNavigator<PetsStackParamList>();

export function PetsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="MyPets">
      <Stack.Screen name="MyPets" component={MyPetsScreen} />
      <Stack.Screen name="PetDetails" component={PetDetailsScreen} />
      <Stack.Screen name="PetForm" component={PetFormScreen} />
      <Stack.Screen name="PetPhoto" component={PetPhotoScreen} />
      <Stack.Screen name="VaccinationRecords" component={VaccinationRecordsScreen} />
      <Stack.Screen name="VaccinationDetails" component={VaccinationDetailsScreen} />
      <Stack.Screen name="UpcomingVaccinations" component={UpcomingVaccinationsScreen} />
      <Stack.Screen name="HealthRecords" component={HealthRecordsScreen} />
      <Stack.Screen name="MedicalHistory" component={MedicalHistoryScreen} />
      <Stack.Screen name="MedicalRecordDetails" component={MedicalRecordDetailsScreen} />
      <Stack.Screen name="AppointmentHistory" component={AppointmentHistoryScreen} />
      <Stack.Screen name="MedicalRecordAttachments" component={MedicalRecordAttachmentsScreen} />
    </Stack.Navigator>
  );
}
