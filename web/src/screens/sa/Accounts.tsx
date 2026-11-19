import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchClinicAdministrators,
  fetchClinicTeamCounts,
  fetchClinics,
  fetchProfilesByIds,
  setClinicStatus,
} from '@/sa/data';
import type { Clinic } from '@/sa/data';
import { CLINIC_ACTIONS, type ClinicAction } from '@/sa/clinicActions';
import {
  ConfirmDialog,
  ConsoleFooter,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  SelectField,
  Stat,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const MANAGED = ['approved', 'suspended', 'inactive'];

/** SA-06 — activation, suspension and reactivation of existing clinic accounts. */
export function ClinicAccounts() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [pending, setPending] = useState<{ clinic: Clinic; action: ClinicAction } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const state = useAsync(async () => {
    const [clinics, administrators, teamCounts] = await Promise.all([
      fetchClinics(),
      fetchClinicAdministrators(),
      fetchClinicTeamCounts(),
    ]);
    const profiles = await fetchProfilesByIds(administrators.map((row) => row.user_id));
    return { clinics, administrators, profiles, teamCounts };
  }, []);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await setClinicStatus(pending.clinic.id, pending.action);
      setNotice({
        tone: 'success',
        text: `${pending.clinic.clinic_name} is now ${result.status}. The change is in the audit log.`,
      });
      setPending(null);
      state.reload();
    } catch (failure) {
      setNotice({
        tone: 'error',
        text: failure instanceof Error ? failure.message : String(failure),
      });
    } finally {
      setBusy(false);
    }
  };

  const managed = (state.data?.clinics ?? []).filter((clinic) => MANAGED.includes(clinic.status));
  const term = search.trim().toLowerCase();
  const rows = managed.filter((clinic) => {
    if (status !== 'all' && clinic.status !== status) return false;
    if (!term) return true;
    return [clinic.clinic_name, clinic.reference, clinic.city, clinic.province]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const administratorOf = (clinicId: string) => {
    const membership = state.data?.administrators.find((row) => row.clinic_id === clinicId);
    if (!membership) return 'Not provisioned';
    const profile = state.data?.profiles.find((row) => row.id === membership.user_id);
    return profile ? fullName(profile) : 'Not provisioned';
  };

  return (
    <div className="page">
      <PageHeader
        title="Clinic account management"
        subtitle="Activation, suspension and closure for clinics that are already on the platform."
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="grid grid--stats">
        <Stat
          label="Active clinics"
          value={managed.filter((clinic) => clinic.status === 'approved').length}
          note="Visible to pet owners"
        />
        <Stat
          label="Suspended"
          value={managed.filter((clinic) => clinic.status === 'suspended').length}
          note="Hidden from discovery"
        />
        <Stat
          label="Inactive"
          value={managed.filter((clinic) => clinic.status === 'inactive').length}
          note="Closed accounts"
          muted
        />
      </div>

      <Panel
        title={`${rows.length} managed account${rows.length === 1 ? '' : 's'}`}
        subtitle="Pending and rejected applications are handled from Applications."
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Clinic, reference or city"
              label="Search accounts"
            />
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All managed' },
                { value: 'approved', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
        }
        flush
      >
        {state.loading ? (
          <LoadingState rows={4} />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={state.reload} />
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Clinic</th>
                  <th>Administrator</th>
                  <th>Active team</th>
                  <th>Status</th>
                  <th>Last reviewed</th>
                  <th className="table__right">Account actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((clinic) => (
                  <tr key={clinic.id}>
                    <td>
                      <Link className="linkish" to={`/system-admin/clinics/${clinic.id}`}>
                        {clinic.clinic_name}
                      </Link>
                      <p className="table__secondary">
                        {[clinic.city, clinic.province].filter(Boolean).join(', ') || 'No location'}
                      </p>
                    </td>
                    <td>{administratorOf(clinic.id)}</td>
                    <td className="table__mono">{state.data?.teamCounts[clinic.id] ?? 0}</td>
                    <td>
                      <StatusBadge status={clinic.status} />
                    </td>
                    <td className="table__mono">{formatDate(clinic.reviewed_at)}</td>
                    <td>
                      <div className="table__actions">
                        {clinic.status === 'approved' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPending({ clinic, action: 'suspend' })}
                            >
                              Suspend
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPending({ clinic, action: 'deactivate' })}
                            >
                              Deactivate
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setPending({ clinic, action: 'reactivate' })}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="shield"
            title="No managed clinics yet"
            description="Approve a clinic application first; it then appears here for account management."
          />
        )}
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? CLINIC_ACTIONS[pending.action].title : ''}
        description={pending ? CLINIC_ACTIONS[pending.action].description : ''}
        confirmLabel={pending ? CLINIC_ACTIONS[pending.action].label : 'Confirm'}
        confirmVariant={pending ? CLINIC_ACTIONS[pending.action].variant : 'primary'}
        busy={busy}
        onConfirm={() => void run()}
        onClose={() => {
          if (!busy) setPending(null);
        }}
      />

      <ConsoleFooter />
    </div>
  );
}
