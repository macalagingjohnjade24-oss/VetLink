export type VaccinationStatus = 'Upcoming' | 'Overdue' | 'Completed';

export type Vaccination = {
  id: string;
  reference: string;
  petId: string;
  vaccine: string;
  administeredOn: string | null;
  nextDueISO: string | null;
  clinicId: string;
  status: VaccinationStatus;
  veterinarian?: string;
  details?: string;
  /** Reminder lead time shown on the upcoming vaccination card. */
  reminderDays?: number;
};

export const VACCINATIONS: Vaccination[] = [
  {
    id: 'vac_rabies_milo',
    reference: 'VR-2025-1124',
    petId: 'pet_milo',
    vaccine: 'Rabies vaccination',
    administeredOn: '2025-11-24',
    nextDueISO: '2026-11-24',
    clinicId: 'clinic_paws_care',
    status: 'Upcoming',
    veterinarian: 'Not recorded',
    details: 'Vaccine batch and certificate details available from the clinic.',
    reminderDays: 7,
  },
  {
    id: 'vac_core_milo',
    reference: 'VR-2026-0612',
    petId: 'pet_milo',
    vaccine: 'Core vaccination',
    administeredOn: '2026-06-12',
    nextDueISO: null,
    clinicId: 'clinic_paws_care',
    status: 'Completed',
    veterinarian: 'Not recorded',
    details: 'Next date not recorded. Ask the clinic when the next dose is due.',
  },
  {
    id: 'vac_rabies_coco',
    reference: 'VR-2026-0218',
    petId: 'pet_coco',
    vaccine: 'Rabies vaccination',
    administeredOn: '2026-02-18',
    nextDueISO: '2027-02-18',
    clinicId: 'clinic_happy_tails',
    status: 'Completed',
    veterinarian: 'Not recorded',
    details: 'Vaccine batch and certificate details available from the clinic.',
  },
  {
    id: 'vac_core_coco',
    reference: 'VR-2025-0914',
    petId: 'pet_coco',
    vaccine: 'DHPP booster',
    administeredOn: '2025-09-14',
    nextDueISO: '2026-09-14',
    clinicId: 'clinic_happy_tails',
    status: 'Overdue',
    veterinarian: 'Not recorded',
    details: 'This booster is past its recorded next date.',
    reminderDays: 7,
  },
  {
    id: 'vac_core_snow',
    reference: 'VR-2025-0302',
    petId: 'pet_snow',
    vaccine: 'Core vaccination',
    administeredOn: '2025-03-02',
    nextDueISO: null,
    clinicId: 'clinic_paws_care',
    status: 'Completed',
    veterinarian: 'Not recorded',
    details: 'Next date not recorded. Ask the clinic when the next dose is due.',
  },
];
