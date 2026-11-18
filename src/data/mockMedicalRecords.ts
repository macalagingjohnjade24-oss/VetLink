/** Clinic-entered medical records used by the pet health record screens (mock data). */

export type AttachmentKind = 'PDF' | 'Image';

export type MedicalAttachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  sizeLabel: string;
  uploadedLabel: string;
  previewTitle: string;
  previewLines: string[];
};

export type MedicalRecord = {
  id: string;
  reference: string;
  petId: string;
  title: string;
  dateISO: string;
  clinicId: string;
  veterinarian?: string;
  consultation?: string;
  diagnosis?: string;
  treatment?: string;
  prescriptions?: string;
  notes?: string;
  attachments: MedicalAttachment[];
};

const visitSummary: MedicalAttachment = {
  id: 'att_visit_summary',
  name: 'visit-summary-oct10.pdf',
  kind: 'PDF',
  sizeLabel: '284 KB',
  uploadedLabel: 'Oct 10, 2026',
  previewTitle: 'VISIT SUMMARY',
  previewLines: ['Milo · Wellness consultation', 'Paws & Care Veterinary Clinic', 'October 10, 2026'],
};

const labResult: MedicalAttachment = {
  id: 'att_lab_result',
  name: 'bloodwork-jun12.pdf',
  kind: 'PDF',
  sizeLabel: '412 KB',
  uploadedLabel: 'Jun 12, 2026',
  previewTitle: 'LABORATORY RESULT',
  previewLines: ['Milo · Routine visit', 'Paws & Care Veterinary Clinic', 'June 12, 2026'],
};

export const MEDICAL_RECORDS: MedicalRecord[] = [
  {
    id: 'rec_wellness_oct',
    reference: 'MR-1026-041',
    petId: 'pet_milo',
    title: 'Wellness consultation',
    dateISO: '2026-10-10',
    clinicId: 'clinic_paws_care',
    veterinarian: 'Not recorded',
    consultation: 'Routine wellness visit',
    diagnosis: 'Not recorded',
    treatment: 'Not recorded',
    prescriptions: 'No prescription attached',
    notes: 'Contact the clinic for the complete consultation notes.',
    attachments: [visitSummary],
  },
  {
    id: 'rec_routine_jun',
    reference: 'MR-0612-018',
    petId: 'pet_milo',
    title: 'Routine visit',
    dateISO: '2026-06-12',
    clinicId: 'clinic_paws_care',
    veterinarian: 'Not recorded',
    consultation: 'Vaccination review and general check-up',
    diagnosis: 'Not recorded',
    treatment: 'Vaccination recorded by the clinic',
    prescriptions: 'No prescription attached',
    notes: 'Records are maintained by the veterinary clinic.',
    attachments: [labResult],
  },
  {
    id: 'rec_vacc_coco',
    reference: 'MR-0802-007',
    petId: 'pet_coco',
    title: 'Vaccination consultation',
    dateISO: '2026-08-02',
    clinicId: 'clinic_happy_tails',
    veterinarian: 'Not recorded',
    consultation: 'Booster review',
    diagnosis: 'Not recorded',
    treatment: 'Booster recorded by the clinic',
    prescriptions: 'No prescription attached',
    notes: 'Contact the clinic for the complete consultation notes.',
    attachments: [],
  },
  {
    id: 'rec_wellness_snow',
    reference: 'MR-0518-002',
    petId: 'pet_snow',
    title: 'Wellness check',
    dateISO: '2026-05-18',
    clinicId: 'clinic_paws_care',
    veterinarian: 'Not recorded',
    consultation: 'First wellness visit',
    diagnosis: 'Not recorded',
    treatment: 'Not recorded',
    prescriptions: 'No prescription attached',
    notes: 'Contact the clinic for the complete consultation notes.',
    attachments: [],
  },
];
