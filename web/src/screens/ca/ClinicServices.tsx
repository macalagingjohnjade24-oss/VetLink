import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import {
  SERVICE_AVAILABILITY,
  fetchClinicServices,
  setClinicServiceAvailability,
  type ClinicService,
  type ServiceAvailability,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending } from '@/clinic/components';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const TONE: Record<ServiceAvailability, 'success' | 'warning' | 'neutral'> = {
  available: 'success',
  limited: 'warning',
  unavailable: 'neutral',
};

const money = (value: number) =>
  `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** CA-04 — the clinic's service catalogue, with edit and deactivate actions. */
export function ClinicServices() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash ?? null;

  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [category, setCategory] = useState('all');
  const [pending, setPending] = useState<ClinicService | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    return { services: await fetchClinicServices(clinicId) };
  }, [clinicId, invited]);

  const services = state.data?.services ?? [];
  const categories = useMemo(
    () => [...new Set(services.map((service) => service.category).filter(Boolean))].sort() as string[],
    [services],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return services.filter((service) => {
      if (availability !== 'all' && service.availability !== availability) return false;
      if (category !== 'all' && (service.category ?? '') !== category) return false;
      if (!term) return true;
      return [service.service_name, service.category, service.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [services, search, availability, category]);

  const counts = useMemo(
    () => ({
      total: services.length,
      available: services.filter((service) => service.availability === 'available').length,
      limited: services.filter((service) => service.availability === 'limited').length,
      unavailable: services.filter((service) => service.availability === 'unavailable').length,
    }),
    [services],
  );

  const deactivate = async () => {
    if (!pending || !clinicId) return;
    setBusy(true);
    setNotice(null);
    try {
      await setClinicServiceAvailability(clinicId, pending.id, 'unavailable');
      setNotice({ tone: 'success', text: `${pending.service_name} is now unavailable for booking.` });
      setPending(null);
      state.reload();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Clinic services" subtitle="No clinic assigned yet" />
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
    <div className="page">
      <PageHeader
        title="Clinic services"
        subtitle="What pet owners can book at your clinic. Deactivating hides a service from new bookings without deleting it."
        actions={
          <Link to="/clinic-admin/services/new">
            <Button>Add service</Button>
          </Link>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="metrics">
        <div className="metric">
          <p className="metric__label">Services</p>
          <p className="metric__value">{counts.total}</p>
        </div>
        <div className="metric">
          <p className="metric__label">Available</p>
          <p className="metric__value">{counts.available}</p>
        </div>
        <div className="metric">
          <p className="metric__label">Limited</p>
          <p className="metric__value">{counts.limited}</p>
        </div>
        <div className="metric">
          <p className="metric__label">Unavailable</p>
          <p className="metric__value">{counts.unavailable}</p>
        </div>
      </div>

      <Panel
        title={`${rows.length} service${rows.length === 1 ? '' : 's'}`}
        subtitle="Search by name, category or description."
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Service or category"
            />
            <SelectField
              label="Availability"
              value={availability}
              onChange={setAvailability}
              options={[
                { value: 'all', label: 'All availability' },
                ...SERVICE_AVAILABILITY.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              ]}
            />
            <SelectField
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: 'all', label: 'All categories' },
                ...categories.map((value) => ({ value, label: value })),
              ]}
            />
          </div>
        }
        flush
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Availability</th>
                  <th className="table__right">Price</th>
                  <th className="table__right">Duration</th>
                  <th className="table__right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <p className="table__primary">{service.service_name}</p>
                      <p className="table__secondary" style={{ maxWidth: 360 }}>
                        {service.description ?? 'No description'}
                      </p>
                    </td>
                    <td>{service.category ?? '—'}</td>
                    <td>
                      <StatusBadge status={service.availability} tone={TONE[service.availability]}>
                        {SERVICE_AVAILABILITY.find((option) => option.value === service.availability)
                          ?.label ?? service.availability}
                      </StatusBadge>
                    </td>
                    <td className="table__right table__mono">{money(service.price)}</td>
                    <td className="table__right table__mono">{service.estimated_duration} min</td>
                    <td className="table__right">
                      <div className="table__actions">
                        <Link to={`/clinic-admin/services/${service.id}/edit`}>
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={service.availability === 'unavailable'}
                          onClick={() => setPending(service)}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : services.length ? (
          <EmptyState
            title="No services match those filters"
            description="Clear the search or choose a different availability or category."
          />
        ) : (
          <EmptyState
            icon="stethoscope"
            title="No services yet"
            description="Add the clinic's first service so pet owners can book it."
            action={
              <Link to="/clinic-admin/services/new">
                <Button size="sm" style={{ marginTop: 10 }}>
                  Add service
                </Button>
              </Link>
            }
          />
        )}
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `Deactivate ${pending.service_name}?` : ''}
        description={
          pending
            ? 'The service stops appearing for new bookings. Existing appointments keep it, and you can make it available again by editing it.'
            : ''
        }
        confirmLabel="Deactivate"
        confirmVariant="danger"
        busy={busy}
        onConfirm={() => void deactivate()}
        onClose={() => setPending(null)}
      />

      <ClinicFooter right="Services are clinic-scoped; only their own clinic can edit them" />
    </div>
  );
}
