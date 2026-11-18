import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BookingsHomeScreen } from '../screens/bookings/BookingsHomeScreen';
import { SelectClinicScreen } from '../screens/bookings/SelectClinicScreen';
import { SelectPetScreen } from '../screens/bookings/SelectPetScreen';
import { SelectServiceScreen } from '../screens/bookings/SelectServiceScreen';
import { SelectDateScreen } from '../screens/bookings/SelectDateScreen';
import { SelectTimeScreen } from '../screens/bookings/SelectTimeScreen';
import { BookingInformationScreen } from '../screens/bookings/BookingInformationScreen';
import { BookingReviewScreen } from '../screens/bookings/BookingReviewScreen';
import { BookingConfirmationScreen } from '../screens/bookings/BookingConfirmationScreen';
import { BookingSuccessScreen } from '../screens/bookings/BookingSuccessScreen';
import { AppointmentDetailsScreen } from '../screens/bookings/AppointmentDetailsScreen';
import { RescheduleAppointmentScreen } from '../screens/bookings/RescheduleAppointmentScreen';
import { CancelAppointmentScreen } from '../screens/bookings/CancelAppointmentScreen';
import { AppointmentStatusScreen } from '../screens/bookings/AppointmentStatusScreen';
import { ClinicConsoleScreen } from '../screens/bookings/ClinicConsoleScreen';
import { ClinicAppointmentScreen } from '../screens/bookings/ClinicAppointmentScreen';
import type { BookingsStackParamList } from './types';

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export function BookingsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="BookingsHome">
      <Stack.Screen name="BookingsHome" component={BookingsHomeScreen} />
      <Stack.Screen name="BookingSelectClinic" component={SelectClinicScreen} />
      <Stack.Screen name="BookingSelectPet" component={SelectPetScreen} />
      <Stack.Screen name="BookingSelectService" component={SelectServiceScreen} />
      <Stack.Screen name="BookingSelectDate" component={SelectDateScreen} />
      <Stack.Screen name="BookingSelectTime" component={SelectTimeScreen} />
      <Stack.Screen name="BookingInformation" component={BookingInformationScreen} />
      <Stack.Screen name="BookingReview" component={BookingReviewScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} />
      <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} />
      <Stack.Screen name="RescheduleAppointment" component={RescheduleAppointmentScreen} />
      <Stack.Screen name="CancelAppointment" component={CancelAppointmentScreen} />
      <Stack.Screen name="AppointmentStatus" component={AppointmentStatusScreen} />
      <Stack.Screen name="ClinicConsole" component={ClinicConsoleScreen} />
      <Stack.Screen name="ClinicAppointment" component={ClinicAppointmentScreen} />
    </Stack.Navigator>
  );
}
