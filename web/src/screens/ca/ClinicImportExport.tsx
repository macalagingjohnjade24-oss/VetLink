import { useState, type ChangeEvent } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { downloadCsv, fullName, label } from '@/lib/format';
import {
  fetchClinicAppointmentsForReport,
  fetchClinicProfile,
  fetchClinicServices,
  fetchClinicTeam,
  createClinicService,
  type ClinicProfile,
  type ClinicService,
  type ReportAppointment,
  type TeamMember,
} from '@/clinic/data';
import {
  MAX_IMPORT_ROWS,
  SERVICE_IMPORT_COLUMNS,
  buildServiceImport,
  toServiceInput,
  type ServiceImportPlan,
} from '@/clinic/import';
import { ClinicFooter, InvitationPending, NoClinicAssigned } from '@/clinic/components';
import {
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const MAX_PREVIEW_ROWS = 8;
const MAX_FILE_BYTES = 1024 * 1024;

const money = (value: number | null) =>
  value === null
    ? '—'
    : `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const petName = (appointment: ReportAppointment) =>
  appointment.pets?.pet_name ?? 'Pet name unavailable';

type Loaded = {
  clinic: ClinicProfile;
  services: ClinicService[];
  appointments: ReportAppointment[];
  team: TeamMember[];
};

/**
 * CA-11. Import adds services from a CSV file; export writes the rows the clinic
 * already has. Both directions use the same columns, so an export can seed
 * another clinic's import, and both go through the clinic-scoped queries — no
 * file is uploaded, and no row is written that the policies would refuse.
 */
function ImportExportPanel({
  data,
  clinicId,
  reload,
}: {
  data: Loaded;
  clinicId: string;
  reload: () => void;
}) {
  const { clinic, services, appointments, team } = data;
  const reference = clinic.reference ?? 'clinic';

  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ServiceImportPlan | null>(null);
  const [importing, setImporting] = useState(false);
  const [failures, setFailures] = useState<{ name: string; message: string }[]>([]);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(
    null,
  );

  /** Header row only: nothing invented lands in the clinic's catalogue. */
  const template = () =>
    downloadCsv('vetlink-services-import-template.csv', [...SERVICE_IMPORT_COLUMNS], []);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow choosing the same file again after fixing it.
    event.target.value = '';
    if (!file) return;

    setNotice(null);
    setFailures([]);
    setPlan(null);
    setFileName(file.name);

    if (file.size > MAX_FILE_BYTES) {
      setNotice({ tone: 'error', text: 'That file is larger than 1 MB. Split it into smaller files.' });
      return;
    }

    try {
      const text = await file.text();
      const next = buildServiceImport(text, services.map((service) => service.service_name));
      setPlan(next);
      if (next.error) setNotice({ tone: 'error', text: next.error });
    } catch {
      setNotice({ tone: 'error', text: 'That file could not be read as text.' });
    }
  };

  const runImport = async () => {
    if (!plan || importing) return;
    const rows = plan.rows.filter((row) => row.issues.length === 0);
    if (!rows.length) return;

    setImporting(true);
    setNotice(null);
    setFailures([]);

    let created = 0;
    const failed: { name: string; message: string }[] = [];
    for (const row of rows) {
      const input = toServiceInput(row);
      if (!input) continue;
      try {
        await createClinicService(clinicId, input);
        created += 1;
      } catch (error) {
        failed.push({
          name: row.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    setImporting(false);
    setPlan(null);
    setFileName(null);
    setFailures(failed);
    setNotice({
      tone: failed.length ? 'warning' : 'success',
      text: failed.length
        ? `${created} service${created === 1 ? '' : 's'} imported, ${failed.length} could not be added.`
        : `${created} service${created === 1 ? '' : 's'} imported.`,
    });
    reload();
  };

  const exportServices = () =>
    downloadCsv(
      `vetlink-${reference}-services.csv`,
      [...SERVICE_IMPORT_COLUMNS],
      services.map((service) => [
        service.service_name,
        service.category ?? '',
        service.description ?? '',
        Number(service.price).toFixed(2),
        service.estimated_duration,
        service.availability,
      ]),
    );

  const exportAppointments = () =>
    downloadCsv(
      `vetlink-${reference}-appointments.csv`,
      ['Reference', 'Date', 'Time', 'Pet', 'Owner', 'Service', 'Status', 'Requested'],
      appointments.map((row) => [
        row.reference ?? '',
        row.appointment_date,
        row.appointment_time,
        petName(row),
        row.owner_name ?? '',
        row.service_name ?? '',
        row.status,
        row.created_at.slice(0, 10),
      ]),
    );

  const exportTeam = () =>
    downloadCsv(
      `vetlink-${reference}-team.csv`,
      ['Name', 'Email', 'Role', 'Status', 'Joined'],
      team.map((member) => [
        member.profile ? fullName(member.profile) : '',
        member.profile?.email ?? '',
        label(member.staff_role),
        label(member.status),
        member.created_at.slice(0, 10),
      ]),
    );

  const preview = plan?.rows.slice(0, MAX_PREVIEW_ROWS) ?? [];
  const hidden = (plan?.rows.length ?? 0) - preview.length;

  return (
    <div className="page">
      <PageHeader
        title="Import / export"
        subtitle={`${clinic.clinic_name} · ${services.length} services · ${appointments.length} appointments · ${team.length} team members`}
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="grid grid--two">
        <Panel
          title="Import services"
          subtitle="Add services from a CSV file. Services the clinic already has are left untouched."
          actions={
            <Button size="sm" variant="ghost" onClick={template}>
              Download template
            </Button>
          }
        >
          <div className="stack--sm">
            <div className="field">
              <label className="field__label" htmlFor="service-import-file">
                CSV file
              </label>
              <input
                id="service-import-file"
                className="file-input"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleFile(event)}
                disabled={importing}
              />
              <p className="field__hint">
                Columns: {SERVICE_IMPORT_COLUMNS.join(', ')} — in any order, matched by the header
                row. Empty price, duration and availability default to 0, 30 and available. Up to{' '}
                {MAX_IMPORT_ROWS} rows per file.
              </p>
            </div>

            {plan && !plan.error ? (
              <>
                <p className="field__hint">
                  {fileName} · {plan.rows.length} row{plan.rows.length === 1 ? '' : 's'} ·{' '}
                  {plan.ready} ready · {plan.problem} need attention
                </p>

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="table__right">Line</th>
                        <th>Service</th>
                        <th className="table__right">Price</th>
                        <th className="table__right">Minutes</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row) => (
                        <tr key={row.line}>
                          <td className="table__right table__mono">{row.line}</td>
                          <td>
                            <p className="table__primary">{row.name}</p>
                            <p className="table__secondary">{row.category ?? 'No category'}</p>
                          </td>
                          <td className="table__right table__mono">{money(row.price)}</td>
                          <td className="table__right table__mono">{row.duration ?? '—'}</td>
                          <td>
                            {row.issues.length ? (
                              <span className="table__secondary">{row.issues[0]}</span>
                            ) : (
                              <StatusBadge status="ready" tone="success">
                                Ready
                              </StatusBadge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {hidden > 0 ? (
                    <p className="field__hint" style={{ padding: '10px 16px' }}>
                      …and {hidden} more row{hidden === 1 ? '' : 's'}. Issues are checked on import
                      for every row.
                    </p>
                  ) : null}
                </div>

                <div className="row" style={{ gap: 10 }}>
                  <Button
                    onClick={() => void runImport()}
                    loading={importing}
                    disabled={plan.ready === 0}
                  >
                    Import {plan.ready} service{plan.ready === 1 ? '' : 's'}
                  </Button>
                  {plan.ready === 0 ? (
                    <span className="field__hint">Fix the rows above and choose the file again.</span>
                  ) : null}
                </div>
              </>
            ) : null}

            {failures.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.slice(0, 5).map((failure, index) => (
                      <tr key={`${failure.name}-${index}`}>
                        <td className="table__primary">{failure.name}</td>
                        <td className="table__secondary">{failure.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {failures.length > 5 ? (
                  <p className="field__hint" style={{ padding: '10px 16px' }}>
                    …and {failures.length - 5} more.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Export clinic data"
          subtitle="CSV downloads of the rows this clinic already has"
          flush
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th className="table__right">Rows</th>
                  <th className="table__right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <p className="table__primary">Services</p>
                    <p className="table__secondary">
                      The catalogue, in the import format, so it can seed another clinic.
                    </p>
                  </td>
                  <td className="table__right table__mono">{services.length}</td>
                  <td className="table__right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportServices}
                      disabled={!services.length}
                    >
                      Export
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p className="table__primary">Appointments</p>
                    <p className="table__secondary">
                      Every booking recorded here, including cancelled and rejected ones.
                    </p>
                  </td>
                  <td className="table__right table__mono">{appointments.length}</td>
                  <td className="table__right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportAppointments}
                      disabled={!appointments.length}
                    >
                      Export
                    </Button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p className="table__primary">Team</p>
                    <p className="table__secondary">
                      Memberships with the colleague profile each one is linked to.
                    </p>
                  </td>
                  <td className="table__right table__mono">{team.length}</td>
                  <td className="table__right">
                    <Button size="sm" variant="outline" onClick={exportTeam} disabled={!team.length}>
                      Export
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <ClinicFooter right="Files are built in the browser from this clinic's rows" />
    </div>
  );
}

/** CA-11 — import and export over the administrator's real clinic rows. */
export function ClinicImportExport() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const state = useAsync(async () => {
    if (!clinicId || invited) return null;
    const [clinic, services, appointments, team] = await Promise.all([
      fetchClinicProfile(clinicId),
      fetchClinicServices(clinicId),
      fetchClinicAppointmentsForReport(clinicId, null),
      fetchClinicTeam(clinicId),
    ]);
    if (!clinic) throw new Error('That clinic record could not be loaded.');
    return { clinic, services, appointments, team } satisfies Loaded;
  }, [clinicId, invited]);

  if (!clinicId) return <NoClinicAssigned title="Import / export" />;

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  // Kept mounted while a reload runs, so an import's result notice is not lost.
  if (state.loading && !state.data) {
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
    <ImportExportPanel
      key={state.data.clinic.id}
      data={state.data}
      clinicId={clinicId}
      reload={state.reload}
    />
  );
}
