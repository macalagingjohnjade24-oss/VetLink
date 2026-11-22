import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicProfile, updateClinicSettings, type ClinicProfile } from '@/clinic/data';
import { ClinicFooter, FailedPage, InvitationPending, LoadingPage, NoClinicAssigned } from '@/clinic/components';
import {
  DetailRow,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

/**
 * CA-13. The switches are the two clinic columns no other screen writes:
 * `has_availability` (what the Pet Owner app filters on) and `emergency_service`
 * (shown on the profile and in the platform directory). Availability is a
 * clinic-declared flag, not a check of the appointment diary, and the copy says
 * so instead of implying enforcement. Everything else on the page is read from
 * the clinic's own row.
 */
function SettingsForm({ clinic, clinicId }: { clinic: ClinicProfile; clinicId: string }) {
  const [availability, setAvailability] = useState(clinic.has_availability);
  const [emergency, setEmergency] = useState(clinic.emergency_service);
  const [baseline, setBaseline] = useState({
    availability: clinic.has_availability,
    emergency: clinic.emergency_service,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const dirty = availability !== baseline.availability || emergency !== baseline.emergency;

  const reset = () => {
    setAvailability(baseline.availability);
    setEmergency(baseline.emergency);
    setNotice(null);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const saved = await updateClinicSettings(clinicId, {
        has_availability: availability,
        emergency_service: emergency,
      });
      // Hold the row the database kept, so the form shows what was stored even
      // if the membership was revoked in between.
      setBaseline({
        availability: saved.has_availability,
        emergency: saved.emergency_service,
      });
      setAvailability(saved.has_availability);
      setEmergency(saved.emergency_service);
      setNotice({ tone: 'success', text: 'Clinic settings saved.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Clinic settings"
        subtitle={`${clinic.clinic_name} · ${clinic.reference ?? 'No reference'}`}
        actions={
          <>
            <Button variant="ghost" onClick={reset} disabled={!dirty || busy}>
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
        <div className="stack">
          <Panel
            title="Booking availability"
            subtitle="The flag the Pet Owner app filters and sorts on"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={availability}
                onChange={(event) => setAvailability(event.target.checked)}
                disabled={busy}
              />
              <span>Show the clinic as accepting appointments</span>
            </label>
            <p className="stat__note" style={{ marginTop: 12 }}>
              Pet owners can filter clinics by “Available appointments”. It is the clinic&rsquo;s own
              signal, not a count from the appointment diary, and it does not block a booking on its
              own.
            </p>
          </Panel>

          <Panel
            title="Emergency service"
            subtitle="Shown on your profile and in the clinic directory"
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={emergency}
                onChange={(event) => setEmergency(event.target.checked)}
                disabled={busy}
              />
              <span>Offer emergency care</span>
            </label>
            <p className="stat__note" style={{ marginTop: 12 }}>
              Marks the clinic as offering emergency care. It adds no separate appointment type;
              emergency cases still arrive as normal booking requests.
            </p>
          </Panel>
        </div>

        <Panel title="Clinic record" subtitle="Managed by VetLink platform administration">
          <dl className="detail" style={{ gridTemplateColumns: '130px 1fr' }}>
            <DetailRow term="Status">
              <StatusBadge status={clinic.status} />
            </DetailRow>
            <DetailRow term="Reference">{clinic.reference ?? '—'}</DetailRow>
            <DetailRow term="Registered">{formatDate(clinic.created_at)}</DetailRow>
            <DetailRow term="Last updated">{formatDateTime(clinic.updated_at)}</DetailRow>
          </dl>
          <p className="stat__note" style={{ marginTop: 14 }}>
            Approval, suspension and deactivation are platform decisions. The profile form and this
            page cannot write those columns.
          </p>
        </Panel>
      </div>

      <ClinicFooter right="Two clinic-wide switches, written to this clinic's own row" />
    </div>
  );
}

/** CA-13 — clinic-wide settings on the administrator's real clinic row. */
export function ClinicSettings() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const state = useAsync(async () => {
    if (!clinicId || invited) return null;
    const clinic = await fetchClinicProfile(clinicId);
    if (!clinic) throw new Error('That clinic record could not be loaded.');
    return clinic;
  }, [clinicId, invited]);

  if (!clinicId) return <NoClinicAssigned title="Clinic settings" />;

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) return <LoadingPage rows={5} />;

  if (state.error || !state.data) {
    return <FailedPage title="Clinic settings" message={state.error} onRetry={state.reload} />;
  }

  return <SettingsForm key={state.data.id} clinic={state.data} clinicId={clinicId} />;
}
