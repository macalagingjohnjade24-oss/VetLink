import type { ImageSourcePropType } from 'react-native';

export type PetSpecies = 'Dog' | 'Cat';
export type PetGender = 'Male' | 'Female';

export type Pet = {
  id: string;
  ownerId: string;
  name: string;
  species: PetSpecies;
  breed: string;
  birthDate: string;
  ageLabel: string;
  gender: PetGender;
  weightKg: number;
  color: string;
  microchip?: string;
  notes?: string;
  photo?: ImageSourcePropType | null;
};

export const PETS: Pet[] = [
  {
    id: 'pet_milo',
    ownerId: 'usr_demo_owner',
    name: 'Milo',
    species: 'Dog',
    breed: 'Golden Retriever',
    birthDate: '2023-05-12',
    ageLabel: '3 years',
    gender: 'Male',
    weightKg: 28,
    color: 'Golden',
    notes: 'Sensitive to chicken-based treats.',
    photo: require('../../assets/onboarding/dog.png'),
  },
  {
    id: 'pet_coco',
    ownerId: 'usr_demo_owner',
    name: 'Coco',
    species: 'Dog',
    breed: 'Beagle',
    birthDate: '2024-06-02',
    ageLabel: '2 years',
    gender: 'Female',
    weightKg: 9.1,
    color: 'Tricolour',
    notes: 'Loves the clinic treats, a little shy with strangers.',
    photo: null,
  },
  {
    id: 'pet_snow',
    ownerId: 'usr_demo_owner',
    name: 'Snow',
    species: 'Cat',
    breed: 'Persian',
    birthDate: '2025-01-20',
    ageLabel: '1 year',
    gender: 'Female',
    weightKg: 4.2,
    color: 'White',
    notes: 'Indoor only, needs a calm waiting area.',
    photo: require('../../assets/onboarding/cat.png'),
  },
];
