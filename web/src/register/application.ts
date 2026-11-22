/**
 * Public clinic registration (REG-02 – REG-07) as pure logic: the draft the
 * wizard edits, each step's validation, and the payload
 * submit_clinic_application() (0004) accepts.
 *
 * No Supabase import, so `npm test` runs it in Node.
 */

export const STEPS = [
  { key: 'account', label: 'Administrator' },
  { key: 'clinic', label: 'Clinic information' },
  { key: 'address', label: 'Address & location' },
  { key: 'services', label: 'Services & hours' },
  { key: 'documents', label: 'Verification documents' },
  { key: 'review', label: 'Review & submit' },
] as const;

export type StepKey = (typeof STEPS)[number]['key'];

export const SERVICE_CHOICES = [
  { name: 'General consultation', description: 'Routine examinations and health advice.', category: 'Consultation' },
  { name: 'Vaccination', description: 'Core and recommended pet vaccines.', category: 'Preventive care' },
  { name: 'Deworming', description: 'Parasite prevention and treatment.', category: 'Preventive care' },
  { name: 'Routine surgery', description: 'Scheduled soft-tissue procedures.', category: 'Surgery' },
  { name: 'Dental care', description: 'Cleaning and oral health checks.', category: 'Dental' },
  { name: 'Laboratory tests', description: 'Blood work and diagnostics.', category: 'Diagnostics' },
  { name: 'Grooming', description: 'Bathing and coat care.', category: 'Grooming' },
] as const;

export const DOCUMENT_KINDS = [
  { value: 'business_permit', label: 'Business / clinic registration', required: true },
  { value: 'veterinary_license', label: 'Veterinary credentials (PRC license)', required: true },
  { value: 'supporting', label: 'Supporting document', required: false },
] as const;

export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type UploadedDocument = {
  name: string;
  storage_path: string;
  kind: string;
  size: number;
};

export type ApplicationDraft = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  clinicName: string;
  description: string;
  clinicEmail: string;
  contactNumber: string;
  website: string;
  yearEstablished: string;
  address: string;
  area: string;
  city: string;
  province: string;
  latitude: string;
  longitude: string;
  services: string[];
  days: number[];
  opens: string;
  closes: string;
  hoursNote: string;
  emergency: boolean;
  documents: UploadedDocument[];
};

export const EMPTY_DRAFT: ApplicationDraft = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  clinicName: '',
  description: '',
  clinicEmail: '',
  contactNumber: '',
  website: '',
  yearEstablished: '',
  address: '',
  area: '',
  city: '',
  province: '',
  latitude: '',
  longitude: '',
  services: ['General consultation', 'Vaccination'],
  days: [1, 2, 3, 4, 5, 6],
  opens: '08:00',
  closes: '18:00',
  hoursNote: '',
  emergency: false,
  documents: [],
};

export type Errors = Partial<Record<string, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;

/** Figma REG-02: 8+ characters with upper, lower, a number and a symbol. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Mix uppercase and lowercase letters.';
  if (!/\d/.test(password)) return 'Add a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Add a symbol.';
  return null;
}

export function validateAccount(
  draft: ApplicationDraft,
  secrets: { password: string; confirm: string; agreed: boolean } | null,
): Errors {
  const errors: Errors = {};
  if (!draft.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!draft.lastName.trim()) errors.lastName = 'Enter your last name.';
  if (!EMAIL.test(draft.email.trim())) errors.email = 'Enter a valid email address.';
  if (!PHONE.test(draft.mobile.trim())) errors.mobile = 'Enter a contact number, e.g. +63 917 000 0000.';
  // An applicant who is already signed in has no password to set here.
  if (secrets) {
    const problem = passwordProblem(secrets.password);
    if (problem) errors.password = problem;
    else if (secrets.password !== secrets.confirm) errors.confirm = 'The passwords do not match.';
    if (!secrets.agreed) errors.agreed = 'Confirm you are authorized to register this clinic.';
  }
  return errors;
}

export function validateClinic(draft: ApplicationDraft, thisYear: number): Errors {
  const errors: Errors = {};
  if (draft.clinicName.trim().length < 3) errors.clinicName = 'Enter the clinic’s registered name.';
  if (draft.clinicEmail.trim() && !EMAIL.test(draft.clinicEmail.trim())) {
    errors.clinicEmail = 'Enter a valid clinic email, or leave it empty.';
  }
  if (!PHONE.test(draft.contactNumber.trim())) errors.contactNumber = 'Enter the clinic’s contact number.';
  if (draft.website.trim() && !/^https?:\/\/\S+\.\S+/.test(draft.website.trim())) {
    errors.website = 'Start the website with http:// or https://.';
  }
  if (draft.yearEstablished.trim()) {
    const year = Number(draft.yearEstablished);
    if (!Number.isInteger(year) || year < 1900 || year > thisYear) {
      errors.yearEstablished = `Enter a year between 1900 and ${thisYear}.`;
    }
  }
  return errors;
}

export function validateAddress(draft: ApplicationDraft): Errors {
  const errors: Errors = {};
  if (draft.address.trim().length < 5) errors.address = 'Enter the street address.';
  if (!draft.city.trim()) errors.city = 'Enter the city or municipality.';
  if (!draft.province.trim()) errors.province = 'Enter the province or region.';
  const lat = draft.latitude.trim();
  const lng = draft.longitude.trim();
  if (lat || lng) {
    const la = Number(lat);
    const lo = Number(lng);
    if (!lat || !Number.isFinite(la) || la < -90 || la > 90) errors.latitude = 'Latitude is between -90 and 90.';
    if (!lng || !Number.isFinite(lo) || lo < -180 || lo > 180) {
      errors.longitude = 'Longitude is between -180 and 180.';
    }
  }
  return errors;
}

export function validateServices(draft: ApplicationDraft): Errors {
  const errors: Errors = {};
  if (!draft.services.length) errors.services = 'Choose at least one service.';
  if (!draft.days.length) errors.days = 'Choose the days the clinic is open.';
  if (!draft.opens || !draft.closes) errors.hours = 'Set opening and closing times.';
  else if (draft.closes <= draft.opens) errors.hours = 'Closing time must be after opening time.';
  return errors;
}

export function validateDocuments(draft: ApplicationDraft): Errors {
  const missing = DOCUMENT_KINDS.filter(
    (kind) => kind.required && !draft.documents.some((doc) => doc.kind === kind.value),
  );
  return missing.length
    ? { documents: `Upload: ${missing.map((kind) => kind.label).join(' and ')}.` }
    : {};
}

/** Why a picked file cannot be uploaded, or null when it can. */
export function fileProblem(file: { type: string; size: number; name: string }): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name}: use a PDF, JPG or PNG file.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: files must be 10 MB or smaller.`;
  return null;
}

/** "Monday–Saturday · 08:00–18:00", stored as the hours note when none is typed. */
export function hoursSummary(draft: Pick<ApplicationDraft, 'days' | 'opens' | 'closes'>): string {
  const days = [...draft.days].sort((a, b) => a - b);
  const contiguous = days.every((day, index) => index === 0 || day === days[index - 1] + 1);
  const label =
    days.length === 7
      ? 'Daily'
      : contiguous && days.length > 2
        ? `${WEEKDAYS[days[0]]}–${WEEKDAYS[days[days.length - 1]]}`
        : days.map((day) => WEEKDAYS[day]).join(', ');
  return `${label} · ${draft.opens}–${draft.closes}`;
}

const text = (value: string) => (value.trim() ? value.trim() : null);

/** The jsonb submit_clinic_application() reads. */
export function buildPayload(draft: ApplicationDraft) {
  return {
    clinic_name: draft.clinicName.trim(),
    description: text(draft.description),
    email: text(draft.clinicEmail) ?? draft.email.trim(),
    contact_number: draft.contactNumber.trim(),
    address: draft.address.trim(),
    area: text(draft.area),
    city: draft.city.trim(),
    province: draft.province.trim(),
    latitude: draft.latitude.trim() ? Number(draft.latitude) : null,
    longitude: draft.longitude.trim() ? Number(draft.longitude) : null,
    website: text(draft.website),
    year_established: draft.yearEstablished.trim() ? Number(draft.yearEstablished) : null,
    emergency_service: draft.emergency,
    operating_hours: {
      days: [...draft.days].sort((a, b) => a - b),
      opens: draft.opens,
      closes: draft.closes,
      note: text(draft.hoursNote) ?? hoursSummary(draft),
    },
    services: draft.services.map((name) => {
      const known = SERVICE_CHOICES.find((choice) => choice.name === name);
      return {
        service_name: name,
        description: known?.description ?? null,
        category: known?.category ?? null,
      };
    }),
    documents: draft.documents.map(({ name, storage_path, kind }) => ({ name, storage_path, kind })),
  };
}
