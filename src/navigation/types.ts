import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ClinicFilters } from '../services/clinicService';
import type { InquiryCategory } from '../data/mockAssistant';

/** Routes rendered inside the Home tab stack. */
export type HomeStackParamList = {
  Home: undefined;
  Notifications: undefined;
  NotificationDetails: { id: string };
  GlobalSearch: { query?: string } | undefined;
};

/** Routes rendered inside the Clinics tab stack. */
export type ClinicsStackParamList = {
  ClinicDiscovery: undefined;
  ClinicSearchResults: { query?: string; filters?: ClinicFilters } | undefined;
  MapView: { filters?: ClinicFilters } | undefined;
  FilterSort: { filters?: ClinicFilters; returnTo?: 'ClinicSearchResults' | 'MapView' } | undefined;
  ClinicDetails: { clinicId: string };
  ClinicServices: { clinicId: string };
  ServiceDetails: { clinicId: string; serviceId: string };
  ClinicContact: { clinicId: string };
};

/** Routes rendered inside the Bookings tab stack. */
export type BookingsStackParamList = {
  BookingsHome: undefined;
  BookingSelectClinic: { clinicId?: string; serviceId?: string } | undefined;
  BookingSelectPet: undefined;
  BookingSelectService: undefined;
  BookingSelectDate: undefined;
  BookingSelectTime: undefined;
  BookingInformation: undefined;
  BookingReview: undefined;
  BookingConfirmation: { appointmentId: string };
  BookingSuccess: { appointmentId: string };
  AppointmentDetails: { appointmentId: string };
  RescheduleAppointment: { appointmentId: string };
  CancelAppointment: { appointmentId: string };
  AppointmentStatus: { appointmentId: string };
  ClinicConsole: undefined;
  ClinicAppointment: { appointmentId: string };
};

/** Routes rendered inside the My Pets tab stack. */
export type PetsStackParamList = {
  MyPets: undefined;
  PetDetails: { petId: string };
  PetForm: { mode: 'add' | 'edit'; petId?: string };
  PetPhoto: { petId?: string } | undefined;
  VaccinationRecords: { petId: string };
  VaccinationDetails: { vaccinationId: string };
  UpcomingVaccinations: { petId?: string } | undefined;
  HealthRecords: { petId?: string } | undefined;
  MedicalHistory: { petId: string };
  MedicalRecordDetails: { recordId: string };
  AppointmentHistory: { petId?: string } | undefined;
  MedicalRecordAttachments: { recordId: string };
};

/** Routes rendered inside the Profile tab stack. */
export type ProfileStackParamList = {
  MyProfile: undefined;
  EditProfile: undefined;
  AccountSettings: undefined;
  ChangePassword: undefined;
  PrivacySecurity: undefined;
  HelpSupport: undefined;
  About: undefined;
  Logout: undefined;
};

/** Routes rendered inside the standalone AI assistant stack (no tab bar). */
export type AIStackParamList = {
  AIAssistant: undefined;
  AISuggestedQuestions: undefined;
  AIChat: { question?: string } | undefined;
  AIInquiryForm: { category?: InquiryCategory; details?: string } | undefined;
  AIInquiryConfirmation: { inquiryId: string };
};

/** Bottom tab routes. */
export type TabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  ClinicsTab: NavigatorScreenParams<ClinicsStackParamList> | undefined;
  BookingsTab: NavigatorScreenParams<BookingsStackParamList> | undefined;
  PetsTab: NavigatorScreenParams<PetsStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  FindClinics: undefined;
  Appointments: undefined;
  HealthRecords: undefined;
  Login: undefined;
  SignUp: undefined;
  EmailVerification: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { email?: string } | undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  /** Full-screen assistant flow, shown above the tabs without a tab highlight. */
  AI: NavigatorScreenParams<AIStackParamList> | undefined;
};

export type ScreenProps<Route extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Route
>;

export type HomeScreenProps<Route extends keyof HomeStackParamList> = NativeStackScreenProps<
  HomeStackParamList,
  Route
>;

export type ClinicsScreenProps<Route extends keyof ClinicsStackParamList> = NativeStackScreenProps<
  ClinicsStackParamList,
  Route
>;

export type BookingsScreenProps<Route extends keyof BookingsStackParamList> = NativeStackScreenProps<
  BookingsStackParamList,
  Route
>;

export type PetsScreenProps<Route extends keyof PetsStackParamList> = NativeStackScreenProps<
  PetsStackParamList,
  Route
>;

export type ProfileScreenProps<Route extends keyof ProfileStackParamList> = NativeStackScreenProps<
  ProfileStackParamList,
  Route
>;

export type AIScreenProps<Route extends keyof AIStackParamList> = NativeStackScreenProps<AIStackParamList, Route>;
