import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate, formatDateTime, formatOperatingHours, label } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchClinicProfile,
  fetchClinicServices,
  updateClinicSettings,
  type ClinicProfile,
  type ClinicService,
} from '@/clinic/data';
import {
  ClinicFooter,
  InvitationPending,
  NoClinicAssigned,
  OperatingHoursList,
} from '@/clinic/components';
import {
  DetailRow,
  ErrorState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

/**
 * CA-13. The switches are the two clinic columns no other screen writes:
 * `has_availability` (what the Pet Owner app filters on) and `emergency_service`
 * (displayed on the profile and in the platform directory). Availability is a
 * clinic-declared flag, not a check of the appointment diary, and the copy says
 * so instead of implying enforcement. Everything else on the page is read from
 * the clinic's own rows.
 */
function SettingsForm({
  clinic,
  services,
  clinicId,
}: {
  clinic: ClinicProfile;
  services: ClinicService[];
  clinicId: string;
}) {
  const { user } = useAuth();

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
      // if a trigger or a revoked membership changed it in between.
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

  const counts = {
    total: services.length,
    available: services.filter((service) => service.availability === 'available').length,
    limited: services.filter((service) => service.availability === 'limited').length,
    unavailable: services.filter((service) => service.availability === 'unavailable').length,
  };

  return (
    <div className="page">
      <PageHeader
        title="Clinic settings"
        subtitle={`${clinic.clinic_name} · ${clinic.reference ?? 'No reference'} · clinic-wide switches and record facts`}
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
              <span>
                Show the clinic as accepting appointments
                <p className="stat__note" style={{ marginTop: 4 }}>
                  Pet owners can filter clinics by “Available appointments”. The flag is your
                  clinic&rsquo;s own signal — it is not read from the appointment diary and it does not
                  block a booking on its own.
                </p>
              </span>
            </label>
            <p className="stat__note" style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <Icon name="calendar" size={16} />
              Stored as clinics.has_availability and saved with this form.
            </p>
          </Panel>

          <Panel title="Emergency service" subtitle="Shown on your profile and in the clinic directory">
            <label className="switch">
              <input
                type="checkbox"
                checked={emergency}
                onChange={(event) => setEmergency(event.target.checked)}
                disabled={busy}
              />
              <span>
                Offer emergency care
                <p className="stat__note" style={{ marginTop: 4 }}>
                  This marks the clinic as offering emergency care. It does not add a separate
                  appointment type, and emergency cases still arrive through the normal booking
                  requests.
                </p>
              </span>
            </label>
            <p className="stat__note" style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <Icon name="shield" size={16} />
              Stored as clinics.emergency_service. Only an active clinic administrator can write it.
            </p>
          </Panel>
        </div>

        <div className="stack">
          <Panel title="Clinic record" subtitle="Read-only facts managed by VetLink">
            <dl className="detail" style={{ gridTemplateColumns: '130px 1fr' }}>
              <DetailRow term="Status">
                <StatusBadge status={clinic.status} />
              </DetailRow>
              <DetailRow term="Reference">{clinic.reference ?? '—'}</DetailRow>
              <DetailRow term="Registered">{formatDate(clinic.created_at)}</DetailRow>
              <DetailRow term="Last updated">{formatDateTime(clinic.updated_at)}</DetailRow>
              <DetailRow term="Discovery">
                {clinic.status === 'approved'
                  ? 'Listed for pet owners'
                  : 'Hidden from pet owners until approved'}
              </DetailRow>
            </dl>
            <p className="stat__note" style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <Icon name="lock" size={16} />
              Approval, suspension and deactivation are platform decisions; 0009 removes the write
              privilege for those columns.
            </p>
          </Panel>

          <Panel title="Your access" subtitle="The membership this console signs you in with">
            <dl className="detail" style={{ gridTemplateColumns: '130px 1fr' }}>
              <DetailRow term="Account">
                {user ? `${user.firstName} ${user.lastName}`.trim() || user.email : '—'}
              </DetailRow>
              <DetailRow term="Email">{user?.email || '—'}</DetailRow>
              <DetailRow term="Role">{label(user?.role)}</DetailRow>
              <DetailRow term="Membership">
                {user?.membershipStatus ? (
                  <StatusBadge status={user.membershipStatus} />
                ) : (
                  '—'
                )}
              </DetailRow>
            </dl>
            <p className="stat__note" style={{ marginTop: 14 }}>
              Clinic administrators are provisioned by VetLink. Staff roles and statuses are managed
              on Staff management, and every write is still checked by the membership policies.
            </p>
          </Panel>
        </div>
      </div>

      <div className="grid grid--two">
        <Panel
          title="Services"
          subtitle={`${counts.total} service${counts.total === 1 ? '' : 's'} on this clinic`}
          actions={
            <Link to="/clinic-admin/services">
              <Button size="sm" variant="outline">
                Manage services
              </Button>
            </Link>
          }
        >
          <div className="metrics">
            <Metric label="Available" value={counts.available} />
            <Metric label="Limited" value={counts.limited} />
            <Metric label="Unavailable" value={counts.unavailable} />
          </div>
          <p className="stat__note" style={{ marginTop: 14 }}>
            Counts come from this clinic&rsquo;s clinic_services rows. A service&rsquo;s availability is
            set per service, not by the clinic-wide booking flag above.
          </p>
        </Panel>

        <Panel
          title="Operating hours"
          subtitle={formatOperatingHours(clinic.operating_hours)}
          actions={
            <Link to="/clinic-admin/profile/edit">
              <Button size="sm" variant="outline">
                Edit on profile
              </Button>
            </Link>
          }
        >
          <OperatingHoursList hours={clinic.operating_hours} />
          <p className="stat__note" style={{ marginTop: 14 }}>
            Opening hours are part of the public clinic profile, so they are edited on the profile
            form rather than duplicated here.
          </p>
        </Panel>
      </div>

      <ClinicFooter right="Settings are written to this clinic's own row" />
    </div>
  );
}

/** CA-13 — clinic-wide settings on the administrator's real clinic row. */
export function ClinicSettings() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const state = useAsync(async () => {
    if (!clinicId) return null;
    if (invited) return null;
    const [clinic, services] = await Promise.all([
      fetchClinicProfile(clinicId),
      fetchClinicServices(clinicId),
    ]);
    if (!clinic) throw new Error('That clinic record could not be loaded.');
    return { clinic, services };
  }, [clinicId, invited]);

  if (!clinicId) return <NoClinicAssigned title="Clinic settings" />;

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
    <SettingsForm
      key={state.data.clinic.id}
      clinic={state.data.clinic}
      services={state.data.services}
      clinicId={clinicId}
    />
  );
}
