import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { downloadCsv, formatDate, formatDateTime, formatOperatingHours, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchClinic,
  fetchClinicDashboard,
  fetchClinicDocuments,
  fetchClinicMemberships,
  fetchClinicServices,
  fetchClinicAdministrators,
  fetchClinics,
  fetchProfilesByIds,
  setClinicStatus,
  signedDocumentUrl,
} from '@/sa/data';
import type { ClinicDocument } from '@/sa/data';
import {
  ConfirmDialog,
  ConsoleFooter,
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { CLINIC_ACTIONS, type ClinicAction } from '@/sa/clinicActions';

const PAGE_SIZE = 10;

/** SA-02 — every registered clinic, searchable and filterable. */
export function ClinicDirectory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const state = useAsync(async () => {
    const [clinics, administrators] = await Promise.all([
      fetchClinics(),
      fetchClinicAdministrators(),
    ]);
    const profiles = await fetchProfilesByIds(administrators.map((row) => row.user_id));
    return { clinics, administrators, profiles };
  }, []);

  const rows = useMemo(() => {
    if (!state.data) return [];
    const { clinics, administrators, profiles } = state.data;
    const administratorOf = (clinicId: string) => {
      const membership = administrators.find((row) => row.clinic_id === clinicId);
      if (!membership) return 'Not provisioned';
      const profile = profiles.find((row) => row.id === membership.user_id);
      return profile ? fullName(profile) : 'Not provisioned';
    };
    const term = search.trim().toLowerCase();

    return clinics
      .map((clinic) => ({ clinic, administrator: administratorOf(clinic.id) }))
      .filter(({ clinic, administrator }) => {
        if (status !== 'all' && clinic.status !== status) return false;
        if (!term) return true;
        return [clinic.clinic_name, clinic.reference, clinic.city, clinic.province, administrator]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [state.data, search, status]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const exportRows = () =>
    downloadCsv(
      'vetlink-clinic-directory.csv',
      ['Reference', 'Clinic', 'City', 'Province', 'Administrator', 'Registered', 'Status'],
      rows.map(({ clinic, administrator }) => [
        clinic.reference ?? '',
        clinic.clinic_name,
        clinic.city ?? '',
        clinic.province ?? '',
        administrator,
        formatDate(clinic.created_at),
        clinic.status,
      ]),
    );

  return (
    <div className="page">
      <PageHeader
        title="Clinic directory"
        subtitle="Every clinic registered on the platform, whatever its status."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={!rows.length}>
            Export CSV
          </Button>
        }
      />

      <Panel
        title={`${rows.length} clinic${rows.length === 1 ? '' : 's'}`}
        subtitle="Search by name, reference, location or administrator."
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Clinic, reference, city"
            />
            <SelectField
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'approved', label: 'Approved' },
                { value: 'pending', label: 'Pending' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
        }
        flush
      >
        {state.loading ? (
          <LoadingState rows={5} />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={state.reload} />
        ) : visible.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Clinic</th>
                    <th>Location</th>
                    <th>Administrator</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th className="table__right" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ clinic, administrator }) => (
                    <tr key={clinic.id}>
                      <td>
                        <p className="table__primary">{clinic.clinic_name}</p>
                        <p className="table__secondary">{clinic.reference ?? 'No reference'}</p>
                      </td>
                      <td>
                        {[clinic.city, clinic.province].filter(Boolean).join(', ') || '—'}
                        {clinic.area ? <p className="table__secondary">{clinic.area}</p> : null}
                      </td>
                      <td>{administrator}</td>
                      <td className="table__mono">{formatDate(clinic.created_at)}</td>
                      <td>
                        <StatusBadge status={clinic.status} />
                      </td>
                      <td className="table__right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/system-admin/clinics/${clinic.id}`)}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={current} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No clinics match those filters"
            description="Clear the search or choose a different status."
          />
        )}
      </Panel>

      <ConsoleFooter />
    </div>
  );
}

/** SA-07 — one clinic from the platform's point of view. */
export function ClinicDetails() {
  const { id } = useParams<{ id: string }>();
  const [pendingAction, setPendingAction] = useState<ClinicAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);

  const state = useAsync(async () => {
    if (!id) throw new Error('No clinic was selected.');
    const [clinic, staff, services, documents, dashboard] = await Promise.all([
      fetchClinic(id),
      fetchClinicMemberships(id),
      fetchClinicServices(id),
      fetchClinicDocuments(id),
      fetchClinicDashboard(id),
    ]);
    if (!clinic) throw new Error('That clinic no longer exists.');
    // Only the accounts on this clinic's team, not the whole platform.
    const profiles = await fetchProfilesByIds(staff.map((row) => row.user_id));
    return { clinic, staff, profiles, services, documents, dashboard };
  }, [id]);

  const runAction = async () => {
    if (!pendingAction || !id) return;
    setBusy(true);
    try {
      const result = await setClinicStatus(id, pendingAction);
      setNotice({ tone: 'success', text: `Clinic status is now ${result.status}.` });
      setPendingAction(null);
      state.reload();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async (document: ClinicDocument) => {
    setDocumentError(null);
    try {
      const url = await signedDocumentUrl(document.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : String(error));
    }
  };

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={6} />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
        <Link to="/system-admin/clinics" className="linkish">
          Back to clinic directory
        </Link>
      </div>
    );
  }

  const { clinic, staff, profiles, services, documents, dashboard } = state.data;
  const administrator = staff.find(
    (row) => row.staff_role === 'clinic_administrator' && row.status !== 'revoked',
  );
  const administratorProfile = administrator
    ? profiles.find((row) => row.id === administrator.user_id)
    : null;

  return (
    <div className="page">
      <PageHeader
        title={clinic.clinic_name}
        subtitle={
          <span className="row" style={{ gap: 10 }}>
            {clinic.reference ?? 'No reference'} · Registered {formatDate(clinic.created_at)}
            <StatusBadge status={clinic.status} />
          </span>
        }
        actions={
          <>
            <Link to="/system-admin/clinics">
              <Button variant="ghost">Back to directory</Button>
            </Link>
            {clinic.status === 'approved' || clinic.status === 'pending' ? (
              <Button variant="outline" onClick={() => setPendingAction('suspend')}>
                Suspend
              </Button>
            ) : null}
            {clinic.status === 'suspended' || clinic.status === 'inactive' ? (
              <Button onClick={() => setPendingAction('reactivate')}>Reactivate</Button>
            ) : null}
          </>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {clinic.review_notes ? (
        <Notice tone="warning">
          <strong>Reviewer note:</strong> {clinic.review_notes}
        </Notice>
      ) : null}

      <div className="grid grid--stats">
        <Metric label="Appointments" value={dashboard.appointments_total} />
        <Metric label="Today" value={dashboard.appointments_today} />
        <Metric label="Registered owners" value={dashboard.owners_registered} />
        <Metric label="Patients" value={dashboard.pets_registered} />
        <Metric label="Active staff" value={dashboard.staff_active} />
        <Metric label="Services available" value={`${dashboard.services_active}/${dashboard.services_total}`} />
      </div>

      <div className="grid grid--detail">
        <Panel title="Clinic information">
          <dl className="detail">
            <DetailRow term="Reference">{clinic.reference ?? '—'}</DetailRow>
            <DetailRow term="Description">{clinic.description ?? 'Not provided'}</DetailRow>
            <DetailRow term="Email">{clinic.email ?? '—'}</DetailRow>
            <DetailRow term="Contact number">{clinic.contact_number ?? '—'}</DetailRow>
            <DetailRow term="Website">{clinic.website ?? '—'}</DetailRow>
            <DetailRow term="Established">{clinic.year_established ?? '—'}</DetailRow>
            <DetailRow term="Emergency service">
              {clinic.emergency_service ? 'Yes' : 'No'}
            </DetailRow>
            <DetailRow term="Address">
              {[clinic.address, clinic.area, clinic.city, clinic.province]
                .filter(Boolean)
                .join(', ') || '—'}
            </DetailRow>
            <DetailRow term="Operating hours">{formatOperatingHours(clinic.operating_hours)}</DetailRow>
            <DetailRow term="Submitted">{formatDateTime(clinic.submitted_at)}</DetailRow>
            <DetailRow term="Last reviewed">{formatDateTime(clinic.reviewed_at)}</DetailRow>
          </dl>
        </Panel>

        <div className="stack">
          <Panel title="Clinic administrator">
            {administratorProfile ? (
              <dl className="detail" style={{ gridTemplateColumns: '110px 1fr' }}>
                <DetailRow term="Name">{fullName(administratorProfile)}</DetailRow>
                <DetailRow term="Email">{administratorProfile.email ?? '—'}</DetailRow>
                <DetailRow term="Phone">{administratorProfile.mobile_number ?? '—'}</DetailRow>
                <DetailRow term="Membership">
                  <StatusBadge status={administrator?.status ?? 'invited'} />
                </DetailRow>
                <DetailRow term="Profile">
                  <Link className="linkish" to={`/system-admin/users/${administratorProfile.id}`}>
                    Open account
                  </Link>
                </DetailRow>
              </dl>
            ) : (
              <EmptyState
                icon="user"
                title="No administrator attached"
                description="Approve the application to provision a Clinic Administrator."
              />
            )}
          </Panel>

          <Panel title="Clinic team" subtitle={`${staff.length} membership${staff.length === 1 ? '' : 's'}`}>
            {staff.length ? (
              <div className="stack--sm">
                {staff.map((row) => {
                  const profile = profiles.find((candidate) => candidate.id === row.user_id);
                  return (
                    <div className="row row--between" key={row.id}>
                      <div>
                        <p className="table__primary">
                          {profile ? fullName(profile) : 'Account removed'}
                        </p>
                        <p className="table__secondary">{row.staff_role.replace(/_/g, ' ')}</p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No memberships recorded yet.</p>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid grid--two">
        <Panel title="Services" subtitle={`${services.length} listed`} flush>
          {services.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Category</th>
                    <th className="table__right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td>
                        <p className="table__primary">{service.service_name}</p>
                        <p className="table__secondary">
                          {service.estimated_duration} min · {service.availability}
                        </p>
                      </td>
                      <td>{service.category ?? '—'}</td>
                      <td className="table__right">₱{Number(service.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="stethoscope" title="No services listed" />
          )}
        </Panel>

        <Panel title="Verification documents" subtitle={`${documents.length} uploaded`}>
          {documentError ? <Notice tone="error">{documentError}</Notice> : null}
          {documents.length ? (
            <div className="stack--sm">
              {documents.map((document) => (
                <div className="row row--between" key={document.id}>
                  <div>
                    <p className="table__primary">{document.name}</p>
                    <p className="table__secondary">
                      {document.kind ?? 'Document'} · {formatDate(document.uploaded_at)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void openDocument(document)}>
                    Open
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="file"
              title="No documents uploaded"
              description="Applicants upload permits and licences during registration."
            />
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? CLINIC_ACTIONS[pendingAction].title : ''}
        description={pendingAction ? CLINIC_ACTIONS[pendingAction].description : ''}
        confirmLabel={pendingAction ? CLINIC_ACTIONS[pendingAction].label : 'Confirm'}
        confirmVariant={pendingAction ? CLINIC_ACTIONS[pendingAction].variant : 'primary'}
        busy={busy}
        onConfirm={() => void runAction()}
        onClose={() => setPendingAction(null)}
      />

      <ConsoleFooter />
    </div>
  );
}
