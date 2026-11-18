/**
 * Mock VetLink Assistant content.
 * NOTE: keyword-matched canned replies. A real build would call the VetLink AI
 * service; nothing here diagnoses or prescribes.
 */
export type SuggestedQuestion = {
  id: string;
  question: string;
  caption: string;
  answer: string;
};

export const ASSISTANT_WELCOME = (firstName: string) =>
  `Hi ${firstName}! I can help with VetLink or collect an inquiry for your clinic. What would you like to know?`;

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    id: 'book',
    question: 'How do I book an appointment?',
    caption: 'Tap to ask the VetLink Assistant',
    answer:
      'Open Clinics, choose a clinic, then tap Book Appointment. Select your pet, a service, and an available date and time. Review your details and submit. The clinic will confirm your request.',
  },
  {
    id: 'find',
    question: 'How can I find a veterinary clinic?',
    caption: 'Tap to ask the VetLink Assistant',
    answer:
      'Open Clinics to browse clinics near you. Use search or the filters to narrow by distance, service and opening hours, then open a clinic to see its services, hours and contact details.',
  },
  {
    id: 'add_pet',
    question: 'How do I add a pet?',
    caption: 'Tap to ask the VetLink Assistant',
    answer:
      'Open My Pets and tap Add Pet. Add their name, species, breed, birth date and weight, then save. You can add a photo and medical notes from their profile.',
  },
  {
    id: 'records',
    question: 'Where can I find vaccination records?',
    caption: 'Tap to ask the VetLink Assistant',
    answer:
      'Open My Pets, choose a pet, then tap Vaccination Records or Health Records. Entries are added by your veterinary clinic, so contact the clinic if something looks incomplete.',
  },
  {
    id: 'reschedule',
    question: 'How do I reschedule an appointment?',
    caption: 'Tap to ask the VetLink Assistant',
    answer:
      'Open Bookings, choose the appointment and tap Reschedule Appointment. The clinic reviews your request; your original time stands until they approve the change.',
  },
  {
    id: 'account',
    question: 'How do I update my account?',
    caption: 'Tap to ask the VetLink Assistant',
    answer:
      'Open Profile, then Account Settings, then Personal information. Your other details save immediately; changing your email needs verification from support.',
  },
];

/** The two feature rows shown on the introduction screen. */
export const INTRO_FEATURES: { questionId: string; caption: string }[] = [
  { questionId: 'book', caption: 'Get step-by-step guidance' },
  { questionId: 'records', caption: 'Find your pet’s clinic-entered records' },
];

/** The inquiry form's category options (PO-54). */
export const INQUIRY_CATEGORIES = ['Appointment assistance', 'Vaccination question', 'General inquiry'] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];
