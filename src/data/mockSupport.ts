/**
 * Mock support content.
 * NOTE: demonstration copy only — replace with real help-centre content and a
 * support address before release.
 */
export const SUPPORT_EMAIL = 'support@vetlink.example';

export type SupportFaq = {
  id: string;
  question: string;
  answer: string;
};

export const SUPPORT_FAQS: SupportFaq[] = [
  {
    id: 'faq_book',
    question: 'How do I book an appointment?',
    answer: 'Choose a clinic, pet, service, date and time.',
  },
  {
    id: 'faq_reschedule',
    question: 'Can I reschedule a visit?',
    answer: 'Request a new time from Appointment Details.',
  },
  {
    id: 'faq_account',
    question: 'How do I update my account?',
    answer: 'Edit your personal details from My Profile.',
  },
  {
    id: 'faq_records',
    question: 'I can’t see a medical record',
    answer: 'Your clinic controls clinical record entries.',
  },
];

/** Case-insensitive filter used by the Help and Support search field. */
export function findFaqs(query: string): SupportFaq[] {
  const term = query.trim().toLowerCase();
  if (!term) return SUPPORT_FAQS;
  return SUPPORT_FAQS.filter(
    (faq) => faq.question.toLowerCase().includes(term) || faq.answer.toLowerCase().includes(term),
  );
}
