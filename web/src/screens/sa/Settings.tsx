import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatDateTime, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchProfile, fetchSettings, saveSettings, type PlatformSettings } from '@/sa/data';
import {
  ConsoleFooter,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

type Form = {
  platform_name: string;
  support_email: string;
  support_phone: string;
  timezone: string;
  appointment_lead_hours: string;
  auto_approve_clinics: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
};

const TIMEZONES = [
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'America/New_York',
  'UTC',
];

function toForm(settings: PlatformSettings): Form {
  return {
    platform_name: settings.platform_name,
    support_email: settings.support_email ?? '',
    support_phone: settings.support_phone ?? '',
    timezone: settings.timezone,
    appointment_lead_hours: String(settings.appointment_lead_hours),
    auto_approve_clinics: settings.auto_approve_clinics,
    maintenance_mode: settings.maintenance_mode,
    maintenance_message: settings.maintenance_message ?? '',
  };
}

/** SA-15 — the platform's real, persisted configuration row. */
export function SystemSettings() {
  const { user } = useAuth();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const state = useAsync(async () => {
    const settings = await fetchSettings();
    const updatedBy = settings?.updated_by ? await fetchProfile(settings.updated_by) : null;
    return { settings, updatedBy };
  }, []);

  const settings = state.data?.settings ?? null;

  useEffect(() => {
    if (settings) setForm(toForm(settings));
  }, [settings]);

  const dirty = Boolean(settings && form && JSON.stringify(toForm(settings)) !== JSON.stringify(form));

  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!form || !user) return;
    const name = form.platform_name.trim();
    if (!name) {
      setNotice({ tone: 'error', text: 'The platform needs a name.' });
      return;
    }
    if (form.support_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.support_email.trim())) {
      setNotice({ tone: 'error', text: 'Enter a valid support email address.' });
      return;
    }
    const hours = Number(form.appointment_lead_hours);
    if (!Number.isInteger(hours) || hours < 0 || hours > 168) {
      setNotice({ tone: 'error', text: 'Lead time must be a whole number of hours between 0 and 168.' });
      return;
    }

    setBusy(true);
    try {
      await saveSettings(
        {
          platform_name: name,
          support_email: form.support_email.trim() || null,
          support_phone: form.support_phone.trim() || null,
          timezone: form.timezone,
          appointment_lead_hours: hours,
          auto_approve_clinics: form.auto_approve_clinics,
          maintenance_mode: form.maintenance_mode,
          maintenance_message: form.maintenance_message.trim() || null,
        },
        user.id,
      );
      setNotice({ tone: 'success', text: 'Platform settings saved and recorded in the audit log.' });
      state.reload();
    } catch (failure) {
      setNotice({
        tone: 'error',
        text:
          failure instanceof Error
            ? failure.message
            : String(failure),
      });
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={5} />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="page">
        <ErrorState message={state.error} onRetry={state.reload} />
      </div>
    );
  }

  if (!settings || !form) {
    return (
      <div className="page">
        <PageHeader title="System settings" />
        <Notice tone="warning">
          The platform settings row is missing. Apply{' '}
          <strong>supabase/migrations/0006_platform_administration.sql</strong> and reload.
        </Notice>
      </div>
    );
  }

  const updatedBy = state.data?.updatedBy;

  return (
    <div className="page">
      <PageHeader
        title="System settings"
        subtitle="Platform identity, policy and maintenance state."
        actions={
          <>
            <Button
              variant="ghost"
              disabled={!dirty || busy}
              onClick={() => setForm(toForm(settings))}
            >
              Reset
            </Button>
            <Button onClick={() => void save()} loading={busy} disabled={!dirty}>
              Save settings
            </Button>
          </>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="grid grid--detail">
        <Panel title="Platform identity" subtitle="Shown to administrators in this console">
          <div className="stack--sm" style={{ display: 'grid', gap: 14 }}>
            <Input
              label="Platform name"
              value={form.platform_name}
              onChange={(event) => update('platform_name', event.target.value)}
              maxLength={60}
            />
            <div className="grid grid--two" style={{ gap: 12 }}>
              <Input
                label="Support email"
                type="email"
                value={form.support_email}
                onChange={(event) => update('support_email', event.target.value)}
                placeholder="support@vetlink.example"
              />
              <Input
                label="Support phone"
                value={form.support_phone}
                onChange={(event) => update('support_phone', event.target.value)}
                placeholder="+63 2 8555 0100"
              />
            </div>
            <SelectField
              label="Platform timezone"
              value={form.timezone}
              onChange={(value) => update('timezone', value)}
              options={TIMEZONES.map((zone) => ({ value: zone, label: zone }))}
            />
            <Input
              label="Minimum appointment lead time (hours)"
              type="number"
              min={0}
              max={168}
              value={form.appointment_lead_hours}
              onChange={(event) => update('appointment_lead_hours', event.target.value)}
              hint="How far ahead of the appointment slot a pet owner may book."
            />
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Clinic onboarding policy">
            <label className="switch">
              <input
                type="checkbox"
                checked={form.auto_approve_clinics}
                onChange={(event) => update('auto_approve_clinics', event.target.checked)}
              />
              <span>
                Auto-approve new clinic applications
                <p className="stat__note" style={{ marginTop: 4 }}>
                  When off, every application waits for a System Administrator. Approving through
                  the console always provisions the administrator either way.
                </p>
              </span>
            </label>
          </Panel>

          <Panel title="Maintenance">
            <div className="stack--sm" style={{ display: 'grid', gap: 14 }}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.maintenance_mode}
                  onChange={(event) => update('maintenance_mode', event.target.checked)}
                />
                <span>
                  Maintenance mode
                  <p className="stat__note" style={{ marginTop: 4 }}>
                    Informational only. This flag is stored and audited, but it does not block bookings
                    or any other workflow. Enforcement would need changes to the Pet Owner app and is not
                    yet implemented.
                  </p>
                </span>
              </label>
              <div className="control">
                <label className="control__label" htmlFor="maintenance-message">
                  Message shown to staff
                </label>
                <textarea
                  id="maintenance-message"
                  className="textarea"
                  value={form.maintenance_message}
                  onChange={(event) => update('maintenance_message', event.target.value)}
                  placeholder="VetLink is read-only while we upgrade the database."
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Change history" subtitle="Who last wrote this row">
        <dl className="detail" style={{ gridTemplateColumns: '180px 1fr' }}>
          <dt>Last saved</dt>
          <dd>{formatDateTime(settings.updated_at)}</dd>
          <dt>Saved by</dt>
          <dd>{updatedBy ? fullName(updatedBy) : 'Not recorded yet'}</dd>
          <dt>Storage</dt>
          <dd>public.platform_settings (one row, readable only by System Administrators)</dd>
        </dl>
        <p className="stat__note" style={{ marginTop: 12 }}>
          These values are the platform's declared policy and are read by this console. Mobile-app
          behaviour that depends on them ships with the later phases.
        </p>
      </Panel>

      <ConsoleFooter right="Settings changes are audited" />
    </div>
  );
}
