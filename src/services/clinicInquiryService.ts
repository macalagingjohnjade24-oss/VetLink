import type { InquiryCategory } from '../data/mockAssistant';
import { requireSupabase } from '../lib/supabase';
import { offlineData, offlineMode } from '../offline/offlineBackend';
import { mapInquiry, type InquiryRecord } from '../types/backend';

/**
 * An inquiry belongs to the signed-in owner and is stored with its first
 * message. Nothing claims the clinic has been notified: there is no forwarding
 * workflow yet, and the UI says so.
 */
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

const toInquiry = (record: InquiryRecord): ClinicInquiry => ({
  id: record.id,
  reference: record.reference,
  ownerName: record.ownerName,
  contact: record.contact,
  petName: record.petName,
  petSpecies: record.petSpecies,
  category: record.category as InquiryCategory,
  details: record.details,
  clinicId: record.clinicId,
  clinicName: record.clinicName,
  submittedAtISO: record.submittedAtISO,
});

export const clinicInquiryService = {
  async submit(input: Omit<ClinicInquiry, 'id' | 'reference' | 'submittedAtISO'>): Promise<ClinicInquiry> {
    if (offlineMode.isActive()) return offlineData.submitInquiry(input);
    const client = requireSupabase();
    const { data: auth } = await client.auth.getUser();
    const owner = auth.user;
    if (!owner) throw new Error('Sign in again to send an inquiry.');

    const { data, error } = await client
      .from('inquiries')
      .insert({
        owner_id: owner.id,
        clinic_id: input.clinicId || null,
        clinic_name: input.clinicName,
        inquiry_type: input.category,
        subject: input.category,
        owner_name: input.ownerName,
        contact: input.contact,
        pet_name: input.petName,
        pet_species: input.petSpecies,
        details: input.details,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    const inquiry = mapInquiry(data as never);
    const { error: messageError } = await client.from('inquiry_messages').insert({
      inquiry_id: inquiry.id,
      sender_id: owner.id,
      sender_type: 'pet_owner',
      message: input.details,
    });
    if (messageError) throw new Error(messageError.message);

    return toInquiry(inquiry);
  },

  async getById(id: string): Promise<ClinicInquiry | null> {
    if (offlineMode.isActive()) return offlineData.inquiryById(id);
    const { data, error } = await requireSupabase().from('inquiries').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toInquiry(mapInquiry(data as never)) : null;
  },
};
