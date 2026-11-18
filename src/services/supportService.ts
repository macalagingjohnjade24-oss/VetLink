import { STORAGE_KEYS, storage } from './storage';

/**
 * Mock support desk.
 * Inquiries are written to local storage and given a reference so the confirmation
 * state is real within the demo; nothing leaves the device.
 */
export type SupportInquiry = {
  id: string;
  reference: string;
  email: string;
  topic: string;
  submittedAtISO: string;
};

const wait = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

export const supportService = {
  async submitInquiry(input: { email: string; topic: string }): Promise<SupportInquiry> {
    await wait();
    const inquiry: SupportInquiry = {
      id: `inq_${Date.now()}`,
      reference: `SUP-${String(Date.now()).slice(-6)}`,
      email: input.email,
      topic: input.topic,
      submittedAtISO: new Date().toISOString(),
    };
    const existing = (await storage.get<SupportInquiry[]>(STORAGE_KEYS.supportInquiries)) ?? [];
    await storage.set(STORAGE_KEYS.supportInquiries, [...existing, inquiry]);
    return inquiry;
  },
};
