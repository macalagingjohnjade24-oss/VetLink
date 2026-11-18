import type { InquiryCategory } from '../data/mockAssistant';
import { STORAGE_KEYS, storage } from './storage';

/** Mock clinic inquiry desk. Inquiries stay on the device and are not sent anywhere. */
export type ClinicInquiry = {
  id: string;
  reference: string;
  ownerName: string;
  contact: string;
  petName: string;
  petSpecies: string;
  category: InquiryCategory;
  details: string;
  clinicId: string;
  clinicName: string;
  submittedAtISO: string;
};

const wait = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));

export const clinicInquiryService = {
  async submit(input: Omit<ClinicInquiry, 'id' | 'reference' | 'submittedAtISO'>): Promise<ClinicInquiry> {
    await wait();
    const existing = (await storage.get<ClinicInquiry[]>(STORAGE_KEYS.clinicInquiries)) ?? [];
    const year = new Date().getFullYear();
    const inquiry: ClinicInquiry = {
      ...input,
      id: `ciq_${Date.now()}`,
      reference: `INQ-${year}-${String(existing.length + 42).padStart(4, '0')}`,
      submittedAtISO: new Date().toISOString(),
    };
    await storage.set(STORAGE_KEYS.clinicInquiries, [...existing, inquiry]);
    return inquiry;
  },

  async getById(id: string): Promise<ClinicInquiry | null> {
    const all = (await storage.get<ClinicInquiry[]>(STORAGE_KEYS.clinicInquiries)) ?? [];
    return all.find((item) => item.id === id) ?? null;
  },
};
