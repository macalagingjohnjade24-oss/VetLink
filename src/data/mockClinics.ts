import type { ImageSourcePropType } from 'react-native';
import type { LatLng } from '../lib/geo';

/** Mock veterinary clinics for the multi-clinic VetLink platform. */
export type ClinicService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
};

export type Clinic = {
  id: string;
  name: string;
  city: string;
  area: string;
  address: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  openNow: boolean;
  hoursLine: string;
  hoursNote: string;
  phone: string;
  email: string;
  description: string;
  services: ClinicService[];
  photo: ImageSourcePropType;
  /** Where the clinic is on the map; null when the clinic has not set it. */
  location: LatLng | null;
  featured: boolean;
  hasAvailability: boolean;
};

export const CLINICS: Clinic[] = [
  {
    id: 'clinic_paws_care',
    name: 'Paws & Care Veterinary Clinic',
    city: 'Makati City',
    area: 'Amorsolo Street',
    address: '123 Amorsolo Street, Legazpi Village, Makati City',
    distanceKm: 1.2,
    rating: 4.8,
    reviewCount: 214,
    openNow: true,
    hoursLine: 'Open today · 8:00 AM–6:00 PM',
    hoursNote: 'Monday–Saturday · Closed Sunday',
    phone: '+63 2 8555 0128',
    email: 'hello@pawsandcare.example',
    description:
      'A welcoming neighborhood clinic offering preventive care and consultations for dogs and cats. Speak with the clinic team about care options and availability.',
    photo: require('../../assets/onboarding/clinic.png'),
    location: { lat: 14.5547, lng: 121.0177 },
    featured: false,
    hasAvailability: true,
    services: [
      {
        id: 'svc_consultation',
        name: 'General consultation',
        description: 'Routine wellness checks and health concerns.',
        durationMinutes: 30,
        price: 750,
      },
      {
        id: 'svc_vaccination',
        name: 'Vaccination',
        description: 'Discuss appropriate vaccinations with the clinic.',
        durationMinutes: 20,
        price: 950,
      },
      {
        id: 'svc_dental',
        name: 'Dental consultation',
        description: 'An assessment of oral health and care needs.',
        durationMinutes: 45,
        price: 1400,
      },
      {
        id: 'svc_preventive',
        name: 'Preventive care',
        description: 'Explore parasite prevention and routine care.',
        durationMinutes: 30,
        price: 850,
      },
    ],
  },
  {
    id: 'clinic_companion',
    name: 'Companion Animal Center',
    city: 'Makati City',
    area: 'Legazpi Village',
    address: '24 Legazpi Street, Legazpi Village, Makati City',
    distanceKm: 2.4,
    rating: 4.7,
    reviewCount: 186,
    openNow: true,
    hoursLine: 'Open today · 9:00 AM–7:00 PM',
    hoursNote: 'Monday–Saturday · Sunday by appointment',
    phone: '+63 2 8555 0163',
    email: 'team@companionanimal.example',
    description:
      'A calm, modern practice with wellness plans, grooming and preventive care for companion animals.',
    photo: require('../../assets/onboarding/vet.png'),
    location: { lat: 14.5592, lng: 121.0181 },
    featured: true,
    hasAvailability: true,
    services: [
      {
        id: 'svc_consultation_ca',
        name: 'General consultation',
        description: 'Wellness checks and health concerns.',
        durationMinutes: 30,
        price: 800,
      },
      {
        id: 'svc_vaccination_ca',
        name: 'Vaccination',
        description: 'Core and booster vaccines.',
        durationMinutes: 20,
        price: 1000,
      },
      {
        id: 'svc_grooming',
        name: 'Grooming',
        description: 'Routine grooming and coat care.',
        durationMinutes: 60,
        price: 900,
      },
    ],
  },
  {
    id: 'clinic_city_paws',
    name: 'City Paws Veterinary Clinic',
    city: 'Makati City',
    area: 'Salcedo Village',
    address: '7 Salcedo Street, Salcedo Village, Makati City',
    distanceKm: 3.1,
    rating: 4.6,
    reviewCount: 121,
    openNow: false,
    hoursLine: 'Opens 9:00 AM',
    hoursNote: 'Monday–Friday · 9:00 AM–6:00 PM',
    phone: '+63 2 8555 0184',
    email: 'care@citypaws.example',
    description: 'A compact city clinic focused on consultations, vaccinations and dental assessments.',
    photo: require('../../assets/onboarding/dog.png'),
    location: { lat: 14.5605, lng: 121.0237 },
    featured: true,
    hasAvailability: false,
    services: [
      {
        id: 'svc_consultation_cp',
        name: 'General consultation',
        description: 'Routine check-ups and health advice.',
        durationMinutes: 30,
        price: 780,
      },
      {
        id: 'svc_dental_cp',
        name: 'Dental consultation',
        description: 'Oral health assessment.',
        durationMinutes: 45,
        price: 1350,
      },
    ],
  },
  {
    id: 'clinic_happy_tails',
    name: 'Happy Tails Animal Clinic',
    city: 'Quezon City',
    area: 'Katipunan Avenue',
    address: '88 Katipunan Avenue, Quezon City',
    distanceKm: 2.6,
    rating: 4.6,
    reviewCount: 168,
    openNow: true,
    hoursLine: 'Open today · 9:00 AM–7:00 PM',
    hoursNote: 'Monday–Saturday · 9:00 AM–7:00 PM',
    phone: '+63 2 8555 0177',
    email: 'hello@happytails.example',
    description: 'Friendly community practice focused on preventive care and vaccinations.',
    photo: require('../../assets/onboarding/vet.png'),
    location: { lat: 14.6386, lng: 121.0745 },
    featured: false,
    hasAvailability: true,
    services: [
      {
        id: 'svc_consultation_ht',
        name: 'General consultation',
        description: 'Routine check-up and health assessment.',
        durationMinutes: 30,
        price: 700,
      },
      {
        id: 'svc_vaccination_ht',
        name: 'Vaccination',
        description: 'Vaccination and booster shots.',
        durationMinutes: 20,
        price: 900,
      },
    ],
  },
  {
    id: 'clinic_northside',
    name: 'Northside Veterinary Center',
    city: 'Pasig City',
    area: 'Ortigas Avenue',
    address: '5 Ortigas Avenue, Pasig City',
    distanceKm: 3.4,
    rating: 4.5,
    reviewCount: 132,
    openNow: false,
    hoursLine: 'Closed today',
    hoursNote: 'Monday–Friday · 10:00 AM–5:00 PM',
    phone: '+63 2 8555 0193',
    email: 'front@northsidevet.example',
    description: 'An established veterinary centre with surgical and diagnostic services.',
    photo: require('../../assets/onboarding/clinic.png'),
    location: { lat: 14.5869, lng: 121.0614 },
    featured: false,
    hasAvailability: false,
    services: [
      {
        id: 'svc_consultation_ns',
        name: 'General consultation',
        description: 'Consultation with a veterinarian.',
        durationMinutes: 30,
        price: 800,
      },
      {
        id: 'svc_surgery_ns',
        name: 'Minor surgery',
        description: 'Day procedures such as wound repair.',
        durationMinutes: 90,
        price: 3200,
      },
    ],
  },
];

/** Service categories offered by the filter sheet. */
export const CLINIC_SERVICE_FILTERS = [
  { key: 'general consultation', label: 'General consultation' },
  { key: 'vaccination', label: 'Vaccination' },
  { key: 'dental', label: 'Dental care' },
  { key: 'grooming', label: 'Grooming' },
] as const;

export const RECENTLY_VIEWED_CLINIC_IDS = ['clinic_paws_care'];
