import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import {
  fetchClinicProfile,
  updateClinicProfile,
  uploadClinicImage,
  type ClinicProfile,
  type ClinicProfileInput,
} from '@/clinic/data';
import { InvitationPending, TextArea } from '@/clinic/components';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Input } from '@/ui/Input';

const DAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
];

const blank = (value: string) => (value.trim() ? value.trim() : null);

function ImageField({
  label,
  hint,
  url,
  busy,
  onSelect,
  onRemove,
}: {
  label: string;
  hint: string;
  url: string | null;
  busy: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onSelect(file);
    // Allow choosing the same file again after a failure.
    event.target.value = '';
  };

  return (
    <div className="image-field">
      <div className="image-field__preview">
        {url ? <img src={url} alt="" /> : <Icon name="image" size={22} />}
      </div>
      <div className="image-field__body">
        <p className="field__label">{label}</p>
        <p className="field__hint">{hint}</p>
        <div className="image-field__actions">
          <input
            className="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
            disabled={busy}
            aria-label={`Upload ${label.toLowerCase()}`}
          />
          {url ? (
            <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy}>
              Remove
            </Button>
          ) : null}
          {busy ? <span className="field__hint">Uploading…</span> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * CA-03. Only the profile columns CA-03 owns are submitted; status, reference
 * and review fields are not in the payload and 0009 removes their UPDATE
 * privilege from the browser role, so this form cannot approve or suspend a
 * clinic even if someone edits the request.
 */
function ClinicProfileForm({ clinic, clinicId }: { clinic: ClinicProfile; clinicId: string }) {
  const hours = clinic.operating_hours;

  const [name, setName] = useState(clinic.clinic_name);
  const [description, setDescription] = useState(clinic.description ?? '');
  const [email, setEmail] = useState(clinic.email ?? '');
  const [contact, setContact] = useState(clinic.contact_number ?? '');
  const [website, setWebsite] = useState(clinic.website ?? '');
  const [address, setAddress] = useState(clinic.address ?? '');
  const [area, setArea] = useState(clinic.area ?? '');
  const [city, setCity] = useState(clinic.city ?? '');
  const [province, setProvince] = useState(clinic.province ?? '');
  const [latitude, setLatitude] = useState(clinic.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(clinic.longitude?.toString() ?? '');

  const [days, setDays] = useState<number[]>(hours?.days ?? []);
  const [opens, setOpens] = useState(hours?.opens ?? '');
  const [closes, setCloses] = useState(hours?.closes ?? '');
  const [hoursNote, setHoursNote] = useState(hours?.note ?? '');

  const [logoUrl, setLogoUrl] = useState(clinic.logo_url);
  const [coverUrl, setCoverUrl] = useState(clinic.cover_url);
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: ReactNode } | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: number) =>
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Clinic name is required.';
    else if (name.trim().length > 120) next.name = 'Use 120 characters or fewer.';

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (contact.trim().length > 40) next.contact = 'Use 40 characters or fewer.';
    if (address.trim().length > 300) next.address = 'Use 300 characters or fewer.';
    if (description.trim().length > 2000) next.description = 'Use 2000 characters or fewer.';

    if ((opens && !closes) || (!opens && closes)) {
      next.hours = 'Set both an opening and a closing time, or clear both.';
    } else if (opens && closes && opens >= closes) {
      next.hours = 'Closing time must be later than opening time.';
    }

    const lat = latitude.trim() === '' ? null : Number(latitude);
    const lng = longitude.trim() === '' ? null : Number(longitude);
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      next.latitude = 'Latitude must be between -90 and 90.';
    }
    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      next.longitude = 'Longitude must be between -180 and 180.';
    }

    return next;
  };

  const buildHours = () => {
    const note = hoursNote.trim();
    if (!days.length && !opens && !closes && !note) return null;
    return {
      days: [...days].sort((a, b) => a - b),
      ...(opens ? { opens } : {}),
      ...(closes ? { closes } : {}),
      ...(note ? { note } : {}),
    };
  };

  const handleUpload = async (kind: 'logo' | 'cover', file: File) => {
    setUploading(kind);
    setNotice(null);
    try {
      const url = await uploadClinicImage(clinicId, kind, file);
      if (kind === 'logo') setLogoUrl(url);
      else setCoverUrl(url);
      setNotice({
        tone: 'success',
        text: `${kind === 'logo' ? 'Logo' : 'Cover photograph'} uploaded. Save the profile to use it.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice({ tone: 'error', text: 'Check the highlighted fields before saving.' });
      return;
    }

    const patch: ClinicProfileInput = {
      clinic_name: name.trim(),
      description: blank(description),
      email: blank(email),
      contact_number: blank(contact),
      address: blank(address),
      area: blank(area),
      city: blank(city),
      province: blank(province),
      latitude: latitude.trim() ? Number(latitude) : null,
      longitude: longitude.trim() ? Number(longitude) : null,
      website: blank(website),
      operating_hours: buildHours(),
      logo_url: logoUrl,
      cover_url: coverUrl,
    };

    setSaving(true);
    setNotice(null);
    try {
      await updateClinicProfile(clinicId, patch);
      // The notice is at the top of the page while Save sits at the bottom.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setNotice({
        tone: 'success',
        text: (
          <>
            Clinic profile saved. Pet owners see the new details as soon as the clinic is approved.{' '}
            <Link className="linkish" to="/clinic-admin/profile">
              View the profile
            </Link>
          </>
        ),
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Edit clinic profile"
        subtitle={`${clinic.clinic_name} · ${clinic.reference ?? 'No reference'} · Changes stay inside your clinic`}
        actions={
          <>
            <Link to="/clinic-admin/profile">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" form="clinic-profile-form" loading={saving}>
              Save changes
            </Button>
          </>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <form id="clinic-profile-form" className="stack" noValidate onSubmit={handleSubmit}>
        <Panel title="Clinic identity" subtitle="Shown to pet owners once the clinic is approved">
          <div className="grid grid--two">
            <Input
              label="Clinic name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
              maxLength={120}
            />
            <Input
              label="Website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://"
              type="url"
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                label="Description"
                value={description}
                onChange={setDescription}
                maxLength={2000}
                error={errors.description}
                hint="A short introduction to the clinic, its team and the care it offers."
              />
            </div>
            <Input
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              type="email"
            />
            <Input
              label="Contact number"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              error={errors.contact}
              maxLength={40}
            />
          </div>
        </Panel>

        <Panel title="Address and location" subtitle="Used by clinic discovery in the Pet Owner app">
          <div className="grid grid--two">
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                label="Street address"
                value={address}
                onChange={setAddress}
                maxLength={300}
                error={errors.address}
                rows={2}
              />
            </div>
            <Input label="Area" value={area} onChange={(event) => setArea(event.target.value)} />
            <Input label="City" value={city} onChange={(event) => setCity(event.target.value)} />
            <Input
              label="Province"
              value={province}
              onChange={(event) => setProvince(event.target.value)}
            />
            <Input
              label="Latitude"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              error={errors.latitude}
              inputMode="decimal"
              placeholder="14.5547"
            />
            <Input
              label="Longitude"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              error={errors.longitude}
              inputMode="decimal"
              placeholder="121.0244"
            />
            <p className="field__hint" style={{ gridColumn: '1 / -1' }}>
              Leave the coordinates empty if you do not know them; the address still appears on the
              clinic profile.
            </p>
          </div>
        </Panel>

        <Panel title="Operating hours" subtitle="One opening window applied to the days you select">
          <div className="stack--sm">
            <div className="field">
              <span className="field__label">Open days</span>
              <div className="chips" role="group" aria-label="Open days">
                {DAYS.map((day) => {
                  const active = days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`chip${active ? ' chip--active' : ''}`}
                      aria-pressed={active}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid--two">
              <Input
                label="Opens"
                value={opens}
                onChange={(event) => setOpens(event.target.value)}
                error={errors.hours}
                type="time"
              />
              <Input
                label="Closes"
                value={closes}
                onChange={(event) => setCloses(event.target.value)}
                type="time"
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <TextArea
                  label="Hours note"
                  value={hoursNote}
                  onChange={setHoursNote}
                  rows={2}
                  maxLength={200}
                  hint="Optional: lunch break, holidays or emergency arrangements."
                />
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Logo and cover photograph"
          subtitle="Uploads go to your clinic's public folder; save afterwards to apply them"
        >
          <div className="stack">
            <ImageField
              label="Clinic logo"
              hint="Square images work best. PNG, JPEG or WebP up to 5 MB."
              url={logoUrl}
              busy={uploading === 'logo'}
              onSelect={(file) => void handleUpload('logo', file)}
              onRemove={() => setLogoUrl(null)}
            />
            <ImageField
              label="Cover photograph"
              hint="Wide images work best. PNG, JPEG or WebP up to 5 MB."
              url={coverUrl}
              busy={uploading === 'cover'}
              onSelect={(file) => void handleUpload('cover', file)}
              onRemove={() => setCoverUrl(null)}
            />
          </div>
        </Panel>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <Link to="/clinic-admin/profile">
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>

      <footer className="page__footer">
        <span>VetLink · Clinic administration · CA-03</span>
        <span>Status and review fields are managed by VetLink platform administration</span>
      </footer>
    </div>
  );
}

/** CA-03 — the administrator edits their own clinic's profile. */
export function ClinicProfileEdit() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    const clinic = await fetchClinicProfile(clinicId);
    if (!clinic) throw new Error('That clinic record could not be loaded.');
    return { clinic };
  }, [clinicId, invited]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Edit clinic profile" subtitle="No clinic assigned yet" />
        <Panel>
          <EmptyState
            icon="map-pin"
            title="No clinic is attached to this account"
            description="A Clinic Administrator manages one clinic. Ask a VetLink System Administrator to provision the clinic account first."
          />
        </Panel>
      </div>
    );
  }

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={5} />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  return (
    <ClinicProfileForm
      key={state.data.clinic.id}
      clinic={state.data.clinic}
      clinicId={clinicId}
    />
  );
}
