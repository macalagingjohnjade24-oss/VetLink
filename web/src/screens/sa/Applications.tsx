import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatDateTime, fullName, label } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  applicationState,
  fetchClinic,
  fetchClinicDocuments,
  fetchClinicMemberships,
  fetchClinicServices,
  fetchClinics,
  fetchMemberships,
  fetchProfiles,
  provisionClinicAdmin,
  reviewApplication,
  signedDocumentUrl,
  type ApplicationState,
  type ClinicDocument,
  type OperatingHours,
} from '@/sa/data';
import {
  ConsoleFooter,
  ConfirmDialog,
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Input } from '@/ui/Input';

const PAGE_SIZE = 10;

const TABS: { key: ApplicationState; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'information_required', label: 'Information required' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function hoursText(hours: OperatingHours): string {
  if (!hours) return '—';
  const window = hours.opens && hours.closes ? `${hours.opens} – ${hours.closes}` : null;
  const days = hours.days?.length ? `${hours.days.length} days a week` : null;
  return [window, days, hours.note].filter(Boolean).join(' · ') || '—';
}

/** SA-03 — submitted clinic applications and their review state. */
export function Applications() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ApplicationState>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const state = useAsync(
    () =>
      Promise.all([fetchClinics(), fetchMemberships(), fetchProfiles()]).then(
        ([clinics, memberships, profiles]) => ({ clinics, memberships, profiles }),
      ),
    [],
  );

  const applications = (state.data?.clinics ?? []).filter((clinic) => clinic.submitted_at);

  const applicantOf = (clinicId: string) => {
    const membership = state.data?.memberships.find(
      (row) => row.clinic_id === clinicId && row.staff_role === 'clinic_administrator',
    );
    if (!membership) return null;
    return state.data?.profiles.find((row) => row.id === membership.user_id) ?? null;
  };

  const term = search.trim().toLowerCase();
  const rows = applications.filter((clinic) => {
    if (applicationState(clinic) !== tab) return false;
    if (!term) return true;
    const applicant = applicantOf(clinic.id);
    return [clinic.clinic_name, clinic.reference, applicant ? fullName(applicant) : '']
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="page">
      <PageHeader
        title="Clinic registration requests"
        subtitle="Applications submitted from the public clinic registration form."
      />

      <div className="chips">
        {TABS.map((item) => {
          const count = applications.filter((clinic) => applicationState(clinic) === item.key).length;
          return (
            <button
              key={item.key}
              type="button"
              className={`chip${tab === item.key ? ' chip--active' : ''}`}
              onClick={() => {
                setTab(item.key);
                setPage(1);
              }}
            >
              {item.label}
              <span className="chip__count">{count}</span>
            </button>
          );
        })}
      </div>

      <Panel
        title={`${rows.length} application${rows.length === 1 ? '' : 's'}`}
        subtitle={
          tab === 'pending'
            ? 'New submissions waiting for a first review.'
            : tab === 'information_required'
              ? 'Waiting on the applicant to send the missing documents.'
              : tab === 'approved'
                ? 'Clinics approved and provisioned on the platform.'
                : 'Applications that were declined, with the reason recorded.'
        }
        actions={
          <SearchField
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Clinic, reference or applicant"
            label="Search applications"
          />
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
                    <th>Applicant</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="table__right" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((clinic) => {
                    const applicant = applicantOf(clinic.id);
                    return (
                      <tr key={clinic.id}>
                        <td>
                          <p className="table__primary">{clinic.clinic_name}</p>
                          <p className="table__secondary">
                            {[clinic.city, clinic.province].filter(Boolean).join(', ') ||
                              clinic.reference ||
                              'No location'}
                          </p>
                        </td>
                        <td>
                          {applicant ? fullName(applicant) : 'Not recorded'}
                          <p className="table__secondary">{applicant?.email ?? '—'}</p>
                        </td>
                        <td className="table__mono">{formatDate(clinic.submitted_at)}</td>
                        <td>
                          <StatusBadge status={applicationState(clinic)} />
                        </td>
                        <td className="table__right">
                          <Button
                            size="sm"
                            variant={applicationState(clinic) === 'pending' ? 'primary' : 'outline'}
                            onClick={() => navigate(`/system-admin/applications/${clinic.id}`)}
                          >
                            {applicationState(clinic) === 'pending' ? 'Review' : 'Open'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={current} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon="clipboard"
            title={
              tab === 'pending'
                ? 'No applications waiting'
                : `No ${TABS.find((item) => item.key === tab)?.label.toLowerCase()} applications`
            }
            description={
              applications.length
                ? 'Switch tabs to see applications in other states.'
                : 'Applications appear here as soon as a clinic submits the registration form.'
            }
          />
        )}
      </Panel>

      <ConsoleFooter />
    </div>
  );
}

/** `status` is the state the action produced, never the pre-action snapshot. */
type Outcome =
  | { kind: 'approved'; message: string; linked: boolean; status: 'approved' }
  | { kind: 'rejected'; message: string; status: 'rejected' }
  | { kind: 'information'; message: string; status: 'pending' };

/** SA-04 (review) and SA-05 (approval / rejection confirmation states). */
export function ApplicationReview() {
  const { id } = useParams<{ id: string }>();
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'info' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentError, setDocumentError] = useState<string | null>(null);
  const prefilled = useRef(false);

  const state = useAsync(async () => {
    if (!id) throw new Error('No application was selected.');
    const [clinic, memberships, profiles, services, documents] = await Promise.all([
      fetchClinic(id),
      fetchClinicMemberships(id),
      fetchProfiles(),
      fetchClinicServices(id),
      fetchClinicDocuments(id),
    ]);
    if (!clinic) throw new Error('That application no longer exists.');
    return { clinic, memberships, profiles, services, documents };
  }, [id]);

  const applicant = (() => {
    if (!state.data) return null;
    const membership = state.data.memberships.find(
      (row) => row.staff_role === 'clinic_administrator',
    );
    if (!membership) return null;
    return state.data.profiles.find((row) => row.id === membership.user_id) ?? null;
  })();

  useEffect(() => {
    if (prefilled.current || !applicant) return;
    prefilled.current = true;
    setEmail(applicant.email ?? '');
    setFirstName(applicant.first_name ?? '');
    setLastName(applicant.last_name ?? '');
  }, [applicant]);

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setError(null);
  };

  const approve = async () => {
    if (!state.data || !id) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address for the Clinic Administrator.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await provisionClinicAdmin({
        clinic_id: id,
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        notes: notes.trim() || undefined,
      });
      setDialog(null);
      setNotes('');
      setOutcome({
        kind: 'approved',
        message: result.message,
        linked: result.status === 'linked',
        status: 'approved',
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'rejected' | 'pending') => {
    if (!id) return;
    if (notes.trim().length < 10) {
      setError('Write at least a short sentence so the applicant knows what to do next.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reviewApplication(id, decision, notes.trim());
      setDialog(null);
      setNotes('');
      setOutcome(
        decision === 'rejected'
          ? {
              kind: 'rejected',
              message: 'The application was rejected and the applicant notified.',
              status: 'rejected',
            }
          : {
              kind: 'information',
              message: 'The applicant was asked for the additional information and notified.',
              status: 'pending',
            },
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async (document: ClinicDocument) => {
    setDocumentError(null);
    try {
      const url = await signedDocumentUrl(document.storage_path);
      window.open(url, '_blank', 'noopener');
    } catch (failure) {
      setDocumentError(failure instanceof Error ? failure.message : String(failure));
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
        <Link to="/system-admin/applications" className="linkish">
          Back to applications
        </Link>
      </div>
    );
  }

  const { clinic, memberships, services, documents } = state.data;

  if (outcome) {
    const copy =
      outcome.kind === 'approved'
        ? {
            title: 'Application approved',
            tone: 'success' as const,
            steps: [
              outcome.message,
              outcome.linked
                ? 'The applicant already had a VetLink account, so access was linked immediately.'
                : 'An activation email was sent to the Clinic Administrator.',
              'The clinic is now listed in the clinic directory with the status Approved.',
            ],
          }
        : outcome.kind === 'rejected'
          ? {
              title: 'Application rejected',
              tone: 'warning' as const,
              steps: [
                outcome.message,
                'The applicant can correct the submission and register the clinic again.',
                'The rejection and its remarks stay in the audit log.',
              ],
            }
          : {
              title: 'Additional information requested',
              tone: 'warning' as const,
              steps: [
                outcome.message,
                'The application stays pending until the applicant responds.',
                'Review it again from the Pending tab once the documents arrive.',
              ],
            };

    return (
      <div className="page">
        <PageHeader
          title={copy.title}
          subtitle={`${clinic.clinic_name} · ${clinic.reference ?? 'No reference'}`}
        />
        <Panel>
          <div className="stack">
            <Notice tone={copy.tone}>
              <strong>Result:</strong> {clinic.clinic_name} is now {label(outcome.status)}.
            </Notice>
            <ol className="stack--sm" style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8 }}>
              {copy.steps.map((step) => (
                <li key={step} style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {step}
                </li>
              ))}
            </ol>
            <div className="row row--wrap">
              <Link to="/system-admin/applications">
                <Button variant="outline">Back to applications</Button>
              </Link>
              <Link to={`/system-admin/clinics/${clinic.id}`}>
                <Button variant="ghost">Open clinic record</Button>
              </Link>
            </div>
          </div>
        </Panel>
        <ConsoleFooter />
      </div>
    );
  }

  const currentState = applicationState(clinic);
  const canReview = currentState === 'pending' || currentState === 'information_required';

  return (
    <div className="page">
      <PageHeader
        title={clinic.clinic_name}
        subtitle={
          <span className="row" style={{ gap: 10 }}>
            {clinic.reference ?? 'No reference'} · Submitted {formatDateTime(clinic.submitted_at)}
            <StatusBadge status={currentState} />
          </span>
        }
        actions={
          <>
            <Link to="/system-admin/applications">
              <Button variant="ghost">Back</Button>
            </Link>
            {canReview ? (
              <>
                <Button variant="outline" onClick={() => setDialog('info')}>
                  Request information
                </Button>
                <Button variant="outline" onClick={() => setDialog('reject')}>
                  Reject
                </Button>
                <Button onClick={() => setDialog('approve')}>Approve &amp; provision</Button>
              </>
            ) : null}
          </>
        }
      />

      {canReview ? (
        <Notice tone="info">
          Approving calls the <strong>provision-clinic-admin</strong> function: it sets the clinic to
          approved and provisions (or links) the Clinic Administrator account. Every decision is
          written to the audit log.
        </Notice>
      ) : (
        <Notice tone={currentState === 'approved' ? 'success' : 'warning'}>
          This application has already been decided. Approvals are re-run from Clinic accounts if
          access needs to be restored.
        </Notice>
      )}

      {clinic.review_notes ? (
        <Notice tone="warning">
          <strong>Last note to the applicant:</strong> {clinic.review_notes}
        </Notice>
      ) : null}

      <div className="grid grid--detail">
        <Panel title="Clinic details">
          <dl className="detail">
            <DetailRow term="Clinic name">{clinic.clinic_name}</DetailRow>
            <DetailRow term="Description">{clinic.description ?? 'Not provided'}</DetailRow>
            <DetailRow term="Email">{clinic.email ?? '—'}</DetailRow>
            <DetailRow term="Contact number">{clinic.contact_number ?? '—'}</DetailRow>
            <DetailRow term="Website">{clinic.website ?? '—'}</DetailRow>
            <DetailRow term="Established">{clinic.year_established ?? '—'}</DetailRow>
            <DetailRow term="Emergency service">{clinic.emergency_service ? 'Yes' : 'No'}</DetailRow>
            <DetailRow term="Address">
              {[clinic.address, clinic.area, clinic.city, clinic.province]
                .filter(Boolean)
                .join(', ') || '—'}
            </DetailRow>
            <DetailRow term="Operating hours">{hoursText(clinic.operating_hours)}</DetailRow>
          </dl>
        </Panel>

        <Panel title="Proposed Clinic Administrator" subtitle="The account that will manage this clinic">
          {applicant ? (
            <dl className="detail" style={{ gridTemplateColumns: '100px 1fr' }}>
              <DetailRow term="Name">{fullName(applicant)}</DetailRow>
              <DetailRow term="Email">{applicant.email ?? '—'}</DetailRow>
              <DetailRow term="Phone">{applicant.mobile_number ?? '—'}</DetailRow>
              <DetailRow term="Membership">
                {memberships.find((row) => row.user_id === applicant.id)?.status === 'invited'
                  ? 'Invited — activates after approval'
                  : 'Linked account'}
              </DetailRow>
              <DetailRow term="Profile">
                <Link className="linkish" to={`/system-admin/users/${applicant.id}`}>
                  Open account
                </Link>
              </DetailRow>
            </dl>
          ) : (
            <EmptyState
              icon="user"
              title="No administrator attached"
              description="The application did not record an administrator account."
            />
          )}
        </Panel>
      </div>

      <div className="grid grid--two">
        <Panel title="Services" subtitle={`${services.length} proposed`} flush>
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
                        <p className="table__secondary">{service.estimated_duration} min</p>
                      </td>
                      <td>{service.category ?? '—'}</td>
                      <td className="table__right">₱{Number(service.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="stethoscope" title="No services proposed" />
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
              description="Permits and licences uploaded during registration appear here."
            />
          )}
        </Panel>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', color: 'var(--muted)', fontSize: 12 }}>
        <Icon name="shield" size={16} />
        Approving, rejecting or requesting information is recorded against your account.
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        title="Approve this clinic?"
        description="This sets the clinic to approved and provisions its Clinic Administrator. An activation email is sent when the applicant has no VetLink account yet."
        confirmLabel="Approve & provision"
        busy={busy}
        onConfirm={() => void approve()}
        onClose={closeDialog}
      >
        <div className="stack--sm" style={{ display: 'grid', gap: 12 }}>
          <Input
            label="Clinic Administrator email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <div className="grid grid--two" style={{ gap: 12 }}>
            <Input
              label="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'reject'}
        title="Reject this application?"
        description="The applicant is notified with your remarks and the clinic is not listed. Records created during registration are kept."
        confirmLabel="Reject application"
        confirmVariant="danger"
        busy={busy}
        onConfirm={() => void decide('rejected')}
        onClose={closeDialog}
      >
        <div className="stack--sm" style={{ display: 'grid', gap: 12 }}>
          <label className="control__label" htmlFor="reject-notes">
            Reason for the applicant
          </label>
          <textarea
            id="reject-notes"
            className="textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="For example: the business permit is unreadable and the clinic address does not match it."
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'info'}
        title="Request additional information"
        description="The application stays pending and the applicant is notified with your request."
        confirmLabel="Send request"
        confirmVariant="outline"
        busy={busy}
        onConfirm={() => void decide('pending')}
        onClose={closeDialog}
      >
        <div className="stack--sm" style={{ display: 'grid', gap: 12 }}>
          <label className="control__label" htmlFor="info-notes">
            What is missing?
          </label>
          <textarea
            id="info-notes"
            className="textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="For example: send a clearer copy of the veterinary licence and the updated operating hours."
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </ConfirmDialog>

      <ConsoleFooter />
    </div>
  );
}
