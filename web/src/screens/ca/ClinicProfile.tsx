import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate, formatDateTime, formatOperatingHours, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicDashboard, fetchClinicProfile, fetchClinicTeam } from '@/clinic/data';
import { ClinicCover, ClinicFooter, OperatingHoursList } from '@/clinic/components';
import {
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

/** CA-02 — the clinic's own profile, exactly as pet owners will see it. */
export function ClinicProfile() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    const [clinic, dashboard, team] = await Promise.all([
      fetchClinicProfile(clinicId),
      fetchClinicDashboard(clinicId),
      fetchClinicTeam(clinicId),
    ]);
    return { clinic, dashboard, team };
  }, [clinicId]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Clinic profile" subtitle="No clinic assigned yet" />
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

  const { clinic, dashboard, team } = state.data;
  if (!clinic) {
    return (
      <div className="page">
        <PageHeader title="Clinic profile" subtitle="Clinic record unavailable" />
        <Panel>
          <EmptyState
            icon="alert"
            title="That clinic could not be read"
            description="The membership points at a clinic this account may no longer access. Ask a VetLink System Administrator to check the clinic account."
          />
        </Panel>
      </div>
    );
  }

  const address = [clinic.address, clinic.area, clinic.city, clinic.province]
    .filter(Boolean)
    .join(', ');
  const administrators = team.filter(
    (member) => member.staff_role === 'clinic_administrator' && member.status !== 'revoked',
  );

  return (
    <div className="page">
      <PageHeader
        title="Clinic profile"
        subtitle={
          <span className="row" style={{ gap: 10 }}>
            {clinic.reference ?? 'No reference'} · Registered {formatDate(clinic.created_at)}
            <StatusBadge status={clinic.status} />
          </span>
        }
        actions={
          <>
            <Link to="/clinic-admin">
              <Button variant="ghost">Back to dashboard</Button>
            </Link>
            <Button
              variant="outline"
              disabled
              title="Editing clinic information is CA-03, the next screen in Phase 4."
            >
              Edit clinic profile
            </Button>
          </>
        }
      />

      <ClinicCover clinic={clinic} />

      <div className="grid grid--detail">
        <Panel title="Clinic information" subtitle="Shown to pet owners when the clinic is approved">
          <dl className="detail">
            <DetailRow term="Description">
              {clinic.description ?? 'No description has been written yet.'}
            </DetailRow>
            <DetailRow term="Address">{address || 'No address recorded'}</DetailRow>
            <DetailRow term="Contact number">{clinic.contact_number ?? '—'}</DetailRow>
            <DetailRow term="Email">{clinic.email ?? '—'}</DetailRow>
            <DetailRow term="Website">
              {clinic.website ? (
                <a className="linkish" href={clinic.website} target="_blank" rel="noreferrer">
                  {clinic.website}
                </a>
              ) : (
                '—'
              )}
            </DetailRow>
            <DetailRow term="Established">{clinic.year_established ?? '—'}</DetailRow>
            <DetailRow term="Emergency service">
              {clinic.emergency_service ? 'Available' : 'Not offered'}
            </DetailRow>
            <DetailRow term="Last updated">{formatDateTime(clinic.updated_at)}</DetailRow>
          </dl>
        </Panel>

        <div className="stack">
          <Panel title="Operating hours" subtitle={formatOperatingHours(clinic.operating_hours)}>
            <OperatingHoursList hours={clinic.operating_hours} />
          </Panel>

          <Panel title="Clinic status" subtitle="Managed by VetLink platform administration">
            <dl className="detail" style={{ gridTemplateColumns: '130px 1fr' }}>
              <DetailRow term="Status">
                <StatusBadge status={clinic.status} />
              </DetailRow>
              <DetailRow term="Reference">{clinic.reference ?? '—'}</DetailRow>
              <DetailRow term="Registered">{formatDate(clinic.created_at)}</DetailRow>
            </dl>
            <p className="stat__note" style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <Icon name="shield" size={16} />
              Only a VetLink System Administrator can approve, suspend or deactivate a clinic.
            </p>
          </Panel>
        </div>
      </div>

      <div className="grid grid--two">
        <Panel title="Clinic at a glance" subtitle="Counts from clinic_dashboard()">
          <div className="metrics">
            <Metric label="Appointments" value={dashboard.appointments_total} />
            <Metric label="Today" value={dashboard.appointments_today} />
            <Metric label="Pet owners" value={dashboard.owners_registered} />
            <Metric label="Patients" value={dashboard.pets_registered} />
            <Metric
              label="Services available"
              value={`${dashboard.services_active}/${dashboard.services_total}`}
            />
            <Metric label="Active staff" value={dashboard.staff_active} />
          </div>
        </Panel>

        <Panel
          title="Clinic administrators"
          subtitle={`${administrators.length} account${administrators.length === 1 ? '' : 's'} on this clinic`}
        >
          {administrators.length ? (
            <div className="stack--sm">
              {administrators.map((member) => (
                <div className="row row--between" key={member.id}>
                  <div>
                    <p className="table__primary">
                      {member.profile ? fullName(member.profile) : 'Account not linked'}
                    </p>
                    <p className="table__secondary">
                      {member.profile?.email ?? 'No email on file'}
                      {member.profile?.mobile_number ? ` · ${member.profile.mobile_number}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={member.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="user"
              title="No administrator linked"
              description="VetLink provisions the Clinic Administrator when the clinic application is approved."
            />
          )}
        </Panel>
      </div>

      <Panel title="Location" subtitle="Used by clinic discovery in the Pet Owner app">
        <div className="grid grid--two">
          <dl className="detail">
            <DetailRow term="Address">{address || 'No address recorded'}</DetailRow>
            <DetailRow term="Area">{clinic.area ?? '—'}</DetailRow>
            <DetailRow term="City">{clinic.city ?? '—'}</DetailRow>
            <DetailRow term="Province">{clinic.province ?? '—'}</DetailRow>
          </dl>
          <dl className="detail">
            <DetailRow term="Latitude">{clinic.latitude ?? '—'}</DetailRow>
            <DetailRow term="Longitude">{clinic.longitude ?? '—'}</DetailRow>
            <DetailRow term="Discovery">
              {clinic.status === 'approved'
                ? 'Listed for pet owners'
                : 'Hidden until the clinic is approved'}
            </DetailRow>
          </dl>
        </div>
      </Panel>

      <ClinicFooter right="Editing arrives with CA-03" />
    </div>
  );
}
