import { Fragment, useEffect, useState } from 'react';
import { formatDateTime, formatDate, humaniseAction, label } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchAuditActions, fetchAuditLog, fetchClinics } from '@/sa/data';
import {
  ConsoleFooter,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 15;

/** SA-13 — the administrative audit trail, searchable and paged. */
export function AuditLogs() {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const state = useAsync(
    () =>
      Promise.all([
        fetchAuditLog({ search: term, action, page, pageSize: PAGE_SIZE }),
        fetchClinics(),
      ]).then(([log, clinics]) => ({ ...log, clinics })),
    [term, action, page],
  );

  const actions = useAsync(() => fetchAuditActions(), []);
  const clinicName = (id: string | null) =>
    id ? (state.data?.clinics.find((clinic) => clinic.id === id)?.clinic_name ?? 'Clinic') : 'Platform';

  return (
    <div className="page">
      <PageHeader
        title="Administrative audit logs"
        subtitle="Every privileged action, with the administrator, target and timestamp."
      />

      <Panel
        title={`${state.data?.total ?? 0} entr${(state.data?.total ?? 0) === 1 ? 'y' : 'ies'}`}
        subtitle="Search covers the action, the administrator's name and the target id."
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Action, administrator or target"
              label="Search log"
            />
            <SelectField
              label="Action"
              value={action}
              onChange={(value) => {
                setAction(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All actions' },
                ...(actions.data ?? []).map((entry) => ({
                  value: entry,
                  label: humaniseAction(entry),
                })),
              ]}
            />
          </div>
        }
        flush
      >
        {state.loading ? (
          <LoadingState rows={6} />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={state.reload} />
        ) : state.data && state.data.rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Administrator</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Clinic</th>
                    <th className="table__right" />
                  </tr>
                </thead>
                <tbody>
                  {state.data.rows.map((entry) => (
                    <Fragment key={entry.id}>
                      <tr>
                        <td className="table__mono">{formatDateTime(entry.created_at)}</td>
                        <td>
                          {entry.actor_name ?? 'System'}
                          <p className="table__secondary">
                            {entry.actor_role ? label(entry.actor_role) : 'Automated'}
                          </p>
                        </td>
                        <td>
                          <p className="table__primary">{humaniseAction(entry.action)}</p>
                          <p className="table__secondary">{entry.action}</p>
                        </td>
                        <td>
                          {entry.entity_type ?? '—'}
                          <p className="table__secondary">
                            {entry.entity_id ? entry.entity_id.slice(0, 8) : '—'}
                          </p>
                        </td>
                        <td>{clinicName(entry.clinic_id)}</td>
                        <td className="table__right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                            aria-expanded={expanded === entry.id}
                          >
                            {expanded === entry.id ? 'Hide' : 'Details'}
                          </Button>
                        </td>
                      </tr>
                      {expanded === entry.id ? (
                        <tr>
                          <td colSpan={6} style={{ background: 'var(--surface-muted)' }}>
                            <pre
                              style={{
                                margin: 0,
                                fontSize: 12,
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                color: 'var(--text)',
                              }}
                            >
                              {JSON.stringify(entry.details ?? {}, null, 2)}
                            </pre>
                            <p className="table__secondary" style={{ marginTop: 8 }}>
                              Recorded {formatDate(entry.created_at)} · entry {entry.id}
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={state.data.total}
              onPage={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon="clock"
            title="No audit entries match"
            description="Privileged actions are recorded here as soon as an administrator performs one."
          />
        )}
      </Panel>

      <ConsoleFooter right="Entries are append-only" />
    </div>
  );
}
