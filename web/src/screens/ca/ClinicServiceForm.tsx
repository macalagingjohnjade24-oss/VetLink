import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import {
  SERVICE_AVAILABILITY,
  createClinicService,
  fetchClinicService,
  updateClinicService,
  type ClinicService,
  type ClinicServiceInput,
  type ServiceAvailability,
} from '@/clinic/data';
import { InvitationPending, TextArea } from '@/clinic/components';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const blank = (value: string) => (value.trim() ? value.trim() : null);

function ServiceForm({
  clinicId,
  clinicName,
  service,
}: {
  clinicId: string;
  clinicName: string | null;
  service: ClinicService | null;
}) {
  const navigate = useNavigate();
  const editing = service !== null;

  const [name, setName] = useState(service?.service_name ?? '');
  const [category, setCategory] = useState(service?.category ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? String(service.price) : '0');
  const [duration, setDuration] = useState(service ? String(service.estimated_duration) : '30');
  const [availability, setAvailability] = useState<ServiceAvailability>(
    service?.availability ?? 'available',
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};

    if (!name.trim()) next.name = 'Service name is required.';
    else if (name.trim().length > 120) next.name = 'Use 120 characters or fewer.';

    if (category.trim().length > 80) next.category = 'Use 80 characters or fewer.';
    if (description.trim().length > 1000) next.description = 'Use 1000 characters or fewer.';

    if (price.trim() === '') next.price = 'Enter a price (0 is allowed).';
    else {
      const value = Number(price);
      if (!Number.isFinite(value) || value < 0) next.price = 'Enter a price of 0 or more.';
      else if (value > 1_000_000) next.price = 'That price looks too high for one service.';
      else if (!/^\d+(\.\d{1,2})?$/.test(price.trim())) {
        next.price = 'Use at most two decimal places.';
      }
    }

    const minutes = Number(duration);
    if (!duration.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
      next.duration = 'Duration must be a whole number between 1 and 480 minutes.';
    }

    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Enter in a field can submit again while the first save is in flight.
    if (saving) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice('Check the highlighted fields before saving.');
      return;
    }

    const input: ClinicServiceInput = {
      service_name: name.trim(),
      category: blank(category),
      description: blank(description),
      price: Number(price),
      estimated_duration: Number(duration),
      availability,
    };

    setSaving(true);
    setNotice(null);
    try {
      if (service) await updateClinicService(clinicId, service.id, input);
      else await createClinicService(clinicId, input);
      navigate('/clinic-admin/services', {
        replace: true,
        state: { flash: service ? 'Service updated.' : 'Service added.' },
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={editing ? 'Edit service' : 'Add new service'}
        subtitle={
          editing
            ? `${service.service_name} · Changes apply to new bookings only`
            : 'New services appear for pet owners as soon as they are available'
        }
        actions={
          <>
            <Link to="/clinic-admin/services">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" form="clinic-service-form" loading={saving}>
              Save service
            </Button>
          </>
        }
      />

      {notice ? <Notice tone="error">{notice}</Notice> : null}

      <form id="clinic-service-form" className="stack" noValidate onSubmit={handleSubmit}>
        <Panel
          title="Service details"
          subtitle={`${clinicName ?? 'Your clinic'} · readable only by this clinic`}
        >
          <div className="grid grid--two">
            <Input
              label="Service name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
              maxLength={120}
              placeholder="Wellness check-up"
            />
            <Input
              label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              error={errors.category}
              maxLength={80}
              placeholder="Wellness"
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                label="Description"
                value={description}
                onChange={setDescription}
                error={errors.description}
                rows={4}
                maxLength={1000}
                hint="What the service includes, who it is for and anything the owner should bring."
              />
            </div>
          </div>
        </Panel>

        <Panel title="Booking details" subtitle="Shown on the service card in the Pet Owner app">
          <div className="grid grid--two">
            <Input
              label="Price (₱)"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              error={errors.price}
              inputMode="decimal"
              placeholder="850.00"
            />
            <Input
              label="Duration (minutes)"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              error={errors.duration}
              inputMode="numeric"
              placeholder="30"
            />
            <SelectField
              label="Availability"
              value={availability}
              onChange={(value) => setAvailability(value as ServiceAvailability)}
              options={SERVICE_AVAILABILITY}
            />
            <p className="field__hint" style={{ alignSelf: 'end', paddingBottom: 10 }}>
              Set availability to unavailable to hide the service from new bookings without
              deleting past appointments.
            </p>
          </div>
        </Panel>

        <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <Link to="/clinic-admin/services">
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button type="submit" loading={saving}>
            Save service
          </Button>
        </div>
      </form>

      <footer className="page__footer">
        <span>VetLink · Clinic administration · {editing ? 'CA-05 edit' : 'CA-05 add'}</span>
        <span>Service names are unique within your clinic</span>
      </footer>
    </div>
  );
}

/** CA-05 — one form for adding a service and for editing an existing one. */
export function ClinicServiceForm() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    if (!id) return { service: null };
    const service = await fetchClinicService(clinicId, id);
    if (!service) throw new Error('That service could not be found at this clinic.');
    return { service };
  }, [clinicId, invited, id]);

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
        <LoadingState rows={4} />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
        <Link className="linkish" to="/clinic-admin/services">
          Back to clinic services
        </Link>
      </div>
    );
  }

  return (
    <ServiceForm
      key={id ?? 'new'}
      clinicId={clinicId}
      clinicName={user?.clinicName ?? null}
      service={state.data.service}
    />
  );
}
