import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  DOCUMENT_KINDS,
  EMPTY_DRAFT,
  SERVICE_CHOICES,
  STEPS,
  WEEKDAYS,
  fileProblem,
  hoursSummary,
  validateAccount,
  validateAddress,
  validateClinic,
  validateDocuments,
  validateServices,
  type ApplicationDraft,
  type Errors,
} from '@/register/application';
import {
  clearDraft,
  fetchApplicantProfile,
  fetchMyApplication,
  loadDraft,
  removeDocument,
  saveDraft,
  signUpApplicant,
  submitApplication,
  updateApplicantProfile,
  uploadDocument,
} from '@/register/data';
import { TextArea } from '@/clinic/components';
import { Notice } from '@/sa/components';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Input } from '@/ui/Input';
import { RegisterLayout } from './RegisterLayout';
import { LocationPicker } from '@/ui/LocationPicker';
import { toPoint } from '@/lib/geocode';

const ASIDE: Record<string, { title: string; copy: string }> = {
  account: {
    title: 'Your clinic’s administrator',
    copy: 'After approval you’ll manage your assigned clinic and invite authorized team members. This is not registration for platform administrators.',
  },
  clinic: {
    title: 'Shown to pet owners',
    copy: 'Once approved, the clinic name, description and contact details appear in the VetLink app’s clinic locator.',
  },
  address: {
    title: 'Help owners find you',
    copy: 'Coordinates place your clinic on the map. You can copy them from Google Maps (right-click the pin). They are optional.',
  },
  services: {
    title: 'You can change these later',
    copy: 'Services, prices and schedules can be updated from your clinic workspace after approval.',
  },
  documents: {
    title: 'Private to reviewers',
    copy: 'Documents are stored privately and read only by VetLink System Administrators and your clinic.',
  },
  review: {
    title: 'Approval is required',
    copy: 'Your clinic stays inactive until a System Administrator approves your application. You will be able to sign in once it is approved.',
  },
};

function formatBytes(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

/** REG-02 – REG-07 — the six-step clinic application. */
export function RegisterApply() {
  const navigate = useNavigate();
  const resumed = loadDraft();
  const [draft, setDraft] = useState<ApplicationDraft>(resumed?.draft ?? EMPTY_DRAFT);
  const [step, setStep] = useState(resumed?.step ?? 0);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [blockedRole, setBlockedRole] = useState<string | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [docKind, setDocKind] = useState<string>(DOCUMENT_KINDS[0].value);

  // Track the session, including the one the email-confirmation link brings back.
  useEffect(() => {
    let live = true;
    const resolve = async (id: string | null) => {
      if (!live) return;
      setUserId(id);
      if (!id) {
        // Steps after the first write as the applicant (uploads, the submit),
        // so a draft resumed without a session goes back to the account step.
        setStep(0);
        setChecking(false);
        return;
      }
      try {
        const [profile, application] = await Promise.all([fetchApplicantProfile(id), fetchMyApplication()]);
        if (!live) return;
        if (application && application.status !== 'rejected') {
          navigate('/register/status', { replace: true });
          return;
        }
        if (profile && profile.role !== 'pet_owner') {
          setBlockedRole(profile.role);
        } else if (profile) {
          setDraft((current) => ({
            ...current,
            firstName: current.firstName || profile.first_name || '',
            lastName: current.lastName || profile.last_name || '',
            email: profile.email ?? current.email,
            mobile: current.mobile || profile.mobile_number || '',
          }));
        }
        setAwaitingEmail(false);
      } catch (error) {
        setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
      } finally {
        if (live) setChecking(false);
      }
    };
    void supabase.auth.getSession().then(({ data }) => resolve(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolve(session?.user.id ?? null);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    saveDraft(draft, step);
  }, [draft, step]);

  const set = <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const field = (key: keyof ApplicationDraft, label: string, extra: Partial<Parameters<typeof Input>[0]> = {}) => (
    <Input
      label={label}
      value={String(draft[key] ?? '')}
      onChange={(event) => set(key, event.target.value as never)}
      error={errors[key]}
      {...extra}
    />
  );

  const go = (next: number) => {
    setErrors({});
    setNotice(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fail = (found: Errors) => {
    setErrors(found);
    setNotice({ tone: 'error', text: 'Check the highlighted fields before continuing.' });
  };

  const continueFrom = async () => {
    if (busy) return;
    const key = STEPS[step].key;

    if (key === 'account') {
      const found = validateAccount(draft, userId ? null : { password, confirm, agreed });
      if (Object.keys(found).length) return fail(found);
      setBusy(true);
      try {
        if (userId) {
          await updateApplicantProfile(userId, draft);
          go(1);
        } else {
          const { signedIn } = await signUpApplicant(draft, password);
          setPassword('');
          setConfirm('');
          if (signedIn) go(1);
          else {
            saveDraft(draft, 1);
            setAwaitingEmail(true);
          }
        }
      } catch (error) {
        setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
      }
      return;
    }

    const found =
      key === 'clinic'
        ? validateClinic(draft, new Date().getFullYear())
        : key === 'address'
          ? validateAddress(draft)
          : key === 'services'
            ? validateServices(draft)
            : key === 'documents'
              ? validateDocuments(draft)
              : {};
    if (Object.keys(found).length) return fail(found);

    if (key === 'review') {
      setBusy(true);
      try {
        const result = await submitApplication(draft);
        clearDraft();
        navigate('/register/status', { replace: true, state: { submitted: result.reference } });
      } catch (error) {
        setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
      }
      return;
    }
    go(step + 1);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;
    const problem = fileProblem(file);
    if (problem) {
      setNotice({ tone: 'error', text: `${problem} The documents already added stay in your application.` });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const uploaded = await uploadDocument(userId, file, docKind);
      set('documents', [...draft.documents, uploaded]);
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const dropDocument = async (path: string) => {
    setBusy(true);
    try {
      await removeDocument(path);
    } catch {
      // The file may already be gone; the application only lists what is kept.
    } finally {
      set(
        'documents',
        draft.documents.filter((doc) => doc.storage_path !== path),
      );
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <RegisterLayout>
        <p className="muted">Loading your application…</p>
      </RegisterLayout>
    );
  }

  if (blockedRole) {
    return (
      <RegisterLayout>
        <div className="reg-form" style={{ maxWidth: 560 }}>
          <h1 className="reg__title">This account already has clinic access</h1>
          <p className="reg__lead">
            Clinic registration is for new clinics. Your account is already a clinic or platform account —
            sign in to your workspace instead, or sign out and register with a different email.
          </p>
          <div className="reg-actions">
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                setBlockedRole(null);
              }}
            >
              Sign out
            </Button>
            <Link to="/login">
              <Button>Go to sign in</Button>
            </Link>
          </div>
        </div>
      </RegisterLayout>
    );
  }

  if (awaitingEmail) {
    return (
      <RegisterLayout>
        <div className="reg-form" style={{ maxWidth: 560, margin: '0 auto' }}>
          <p className="reg__eyebrow">Step 1 complete</p>
          <h1 className="reg__title">Confirm your email to continue</h1>
          <p className="reg__lead">
            We sent a confirmation link to <strong>{draft.email}</strong>. Open it on this device and you’ll
            come straight back here to add your clinic details. Your answers so far are saved in this browser.
          </p>
          <p className="stat__note">
            Didn’t get it? Check spam, or <Link to="/login">sign in</Link> once confirmed and return to{' '}
            <Link to="/register/apply">this page</Link>.
          </p>
        </div>
      </RegisterLayout>
    );
  }

  const key = STEPS[step].key;
  const aside = ASIDE[key];
  const toggleList = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  let body: ReactNode = null;
  if (key === 'account') {
    body = (
      <div className="reg-grid">
        {field('firstName', 'First name *', { autoComplete: 'given-name' })}
        {field('lastName', 'Last name *', { autoComplete: 'family-name' })}
        {field('email', 'Email address *', {
          type: 'email',
          autoComplete: 'email',
          readOnly: Boolean(userId),
          hint: userId ? 'You are signed in with this email.' : undefined,
        })}
        {field('mobile', 'Contact number *', { type: 'tel', autoComplete: 'tel', placeholder: '+63 917 000 0000' })}
        {userId ? null : (
          <>
            <Input
              label="Password *"
              revealable
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              hint="At least 8 characters with uppercase, lowercase, a number and a symbol."
            />
            <Input
              label="Confirm password *"
              revealable
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              error={errors.confirm}
            />
            <div className="reg-grid__full">
              <Checkbox
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                label="I am authorized to register this clinic and agree to the Terms of Use and Privacy Policy."
              />
              {errors.agreed ? <p className="field__error">{errors.agreed}</p> : null}
            </div>
          </>
        )}
        <p className="reg-warning reg-grid__full">
          You are applying to become the Clinic Administrator — not a System Administrator.
        </p>
      </div>
    );
  } else if (key === 'clinic') {
    body = (
      <div className="reg-grid">
        <div className="reg-grid__full">{field('clinicName', 'Registered clinic name *')}</div>
        <div className="reg-grid__full">
          <TextArea
            label="Short description"
            value={draft.description}
            onChange={(value) => set('description', value)}
            rows={3}
            maxLength={600}
            hint="What pet owners should know about your clinic."
          />
        </div>
        {field('clinicEmail', 'Clinic email', { type: 'email', hint: 'Leave empty to use your own email.' })}
        {field('contactNumber', 'Clinic contact number *', { type: 'tel' })}
        {field('website', 'Website', { type: 'url', placeholder: 'https://' })}
        {field('yearEstablished', 'Year established', { inputMode: 'numeric', maxLength: 4 })}
      </div>
    );
  } else if (key === 'address') {
    body = (
      <div className="reg-grid">
        <div className="reg-grid__full">{field('address', 'Street address *', { autoComplete: 'street-address' })}</div>
        {field('area', 'Barangay / area')}
        {field('city', 'City / municipality *', { autoComplete: 'address-level2' })}
        {field('province', 'Province / region *', { autoComplete: 'address-level1' })}
        <div />
        {field('latitude', 'Latitude', { inputMode: 'decimal', placeholder: '14.5547' })}
        {field('longitude', 'Longitude', { inputMode: 'decimal', placeholder: '121.0144' })}
        <div className="reg-grid__full">
          <LocationPicker
            value={toPoint(draft.latitude, draft.longitude)}
            address={[draft.address, draft.area, draft.city, draft.province].filter((part) => part.trim()).join(', ')}
            onChange={(point) => {
              set('latitude', String(point.lat));
              set('longitude', String(point.lng));
            }}
          />
        </div>
      </div>
    );
  } else if (key === 'services') {
    body = (
      <div className="reg-grid">
        <div style={{ display: 'grid', gap: 10 }}>
          <p className="field__label">Available services *</p>
          {SERVICE_CHOICES.map((choice) => {
            const on = draft.services.includes(choice.name);
            return (
              <label key={choice.name} className={`reg-option${on ? ' reg-option--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => set('services', toggleList(draft.services, choice.name))}
                />
                <div>
                  <strong>{choice.name}</strong>
                  <span>{choice.description}</span>
                </div>
              </label>
            );
          })}
          {errors.services ? <p className="field__error">{errors.services}</p> : null}
        </div>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <p className="field__label">Operating hours * · Asia/Manila (UTC+08:00)</p>
          <div className="reg-days" role="group" aria-label="Open days">
            {WEEKDAYS.map((name, index) => (
              <button
                key={name}
                type="button"
                className="reg-day"
                aria-pressed={draft.days.includes(index)}
                onClick={() => set('days', toggleList(draft.days, index))}
              >
                {name}
              </button>
            ))}
          </div>
          {errors.days ? <p className="field__error">{errors.days}</p> : null}
          <div className="reg-grid">
            <Input label="Opening" type="time" value={draft.opens} onChange={(e) => set('opens', e.target.value)} />
            <Input
              label="Closing"
              type="time"
              value={draft.closes}
              onChange={(e) => set('closes', e.target.value)}
              error={errors.hours}
            />
          </div>
          <Input
            label="Hours note (optional)"
            value={draft.hoursNote}
            onChange={(e) => set('hoursNote', e.target.value)}
            placeholder={hoursSummary(draft)}
            hint="Shown to pet owners. Mention breaks or holiday hours."
          />
          <Checkbox
            checked={draft.emergency}
            onChange={(event) => set('emergency', event.target.checked)}
            label="Emergency service available"
          />
        </div>
      </div>
    );
  } else if (key === 'documents') {
    body = (
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="reg-upload">
          <p className="field__label">Add verification document · PDF, JPG or PNG · up to 10 MB each</p>
          <div className="reg-upload__row">
            <select
              className="field__input"
              aria-label="Document type"
              value={docKind}
              onChange={(event) => setDocKind(event.target.value)}
              style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0 10px' }}
            >
              {DOCUMENT_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                  {kind.required ? ' *' : ' (optional)'}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => void onFile(event)}
              disabled={busy || !userId}
              aria-label="Choose file"
            />
          </div>
        </div>
        <div className="reg-docs">
          {draft.documents.length ? (
            draft.documents.map((doc) => (
              <div className="reg-doc" key={doc.storage_path}>
                <div className="reg-doc__name">
                  {doc.name}
                  <small>{DOCUMENT_KINDS.find((kind) => kind.value === doc.kind)?.label ?? 'Document'}</small>
                </div>
                <span className="muted">{formatBytes(doc.size)}</span>
                <span style={{ color: 'var(--success)' }}>Uploaded</span>
                <Button size="sm" variant="ghost" onClick={() => void dropDocument(doc.storage_path)} disabled={busy}>
                  Remove
                </Button>
              </div>
            ))
          ) : (
            <p className="muted">No documents added yet.</p>
          )}
          {errors.documents ? <p className="field__error">{errors.documents}</p> : null}
        </div>
      </div>
    );
  } else {
    const hours = draft.hoursNote.trim() || hoursSummary(draft);
    const section = (title: string, target: number, rows: [string, string][]) => (
      <div className="reg-form" style={{ padding: 16 }}>
        <div className="row row--between">
          <h3 style={{ fontSize: 15 }}>{title}</h3>
          <Button size="sm" variant="ghost" onClick={() => go(target)}>
            Edit
          </Button>
        </div>
        <dl>
          {rows.map(([term, value]) => (
            <div key={term} style={{ display: 'contents' }}>
              <dt>{term}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
    body = (
      <div className="reg-review">
        {section('Administrator', 0, [
          ['Name', `${draft.firstName} ${draft.lastName}`],
          ['Email', draft.email],
          ['Contact', draft.mobile],
        ])}
        {section('Clinic', 1, [
          ['Name', draft.clinicName],
          ['Email', draft.clinicEmail || draft.email],
          ['Contact', draft.contactNumber],
          ['Website', draft.website],
        ])}
        {section('Location', 2, [
          ['Address', [draft.address, draft.area, draft.city, draft.province].filter(Boolean).join(', ')],
          ['Coordinates', draft.latitude && draft.longitude ? `${draft.latitude}, ${draft.longitude}` : 'Not set'],
        ])}
        {section('Services & hours', 3, [
          ['Services', draft.services.join(', ')],
          ['Hours', hours],
          ['Emergency', draft.emergency ? 'Available' : 'Not available'],
        ])}
        {section('Documents', 4, [['Uploaded', draft.documents.map((doc) => doc.name).join(', ')]])}
      </div>
    );
  }

  return (
    <RegisterLayout>
      <div className="reg-wizard">
        <aside className="reg-rail">
          <div>
            <p className="reg__eyebrow">Join the VetLink network</p>
            <h2 style={{ fontSize: 20, marginTop: 4 }}>Clinic registration</h2>
          </div>
          <ol className="reg-steps" aria-label="Registration steps">
            {STEPS.map((item, index) => {
              const state = index < step ? 'done' : index === step ? 'current' : 'todo';
              return (
                <li key={item.key} className={`reg-step reg-step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="reg-step__dot">{index + 1}</span>
                  <span>
                    <span className="reg-step__label">{item.label}</span>
                    <span className="reg-step__state">
                      {state === 'done' ? 'Completed' : state === 'current' ? 'In progress' : 'Not started'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="reg-rail__note">
            <strong>Approval is required</strong>
            Your clinic stays inactive until a System Administrator approves your application.
          </p>
        </aside>

        <div className="reg-body">
          <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
            <div>
              <p className="reg__eyebrow">
                Step {step + 1} of {STEPS.length}
              </p>
              <h1 className="reg__title">{STEPS[step].label}</h1>
            </div>
            {notice ? <Notice tone={notice.tone === 'info' ? 'success' : notice.tone}>{notice.text}</Notice> : null}
            <form
              className="reg-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void continueFrom();
              }}
            >
              {body}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>
          </div>
          <aside className="reg-aside">
            <h3>{aside.title}</h3>
            <p>{aside.copy}</p>
          </aside>
          <div className="reg-actions">
            {step > 0 ? (
              <Button variant="outline" onClick={() => go(step - 1)} disabled={busy}>
                Back
              </Button>
            ) : (
              <Link to="/register">
                <Button variant="outline">Back</Button>
              </Link>
            )}
            <Button onClick={() => void continueFrom()} loading={busy}>
              {key === 'review' ? 'Submit application' : key === 'account' && !userId ? 'Create account & continue' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </RegisterLayout>
  );
}
