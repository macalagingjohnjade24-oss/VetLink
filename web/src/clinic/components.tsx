import { StatusBadge } from '@/sa/components';
import { Icon } from '@/ui/Icon';
import type { ClinicProfile, OperatingHours } from './data';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || 'VL';

/** Cover photograph, logo and identity line shared by CA-01 and CA-02. */
export function ClinicCover({ clinic }: { clinic: ClinicProfile }) {
  const location = [clinic.city, clinic.province].filter(Boolean).join(', ');

  return (
    <section className="clinic-cover">
      <div
        className="clinic-cover__media"
        style={clinic.cover_url ? { backgroundImage: `url(${clinic.cover_url})` } : undefined}
      >
        {clinic.cover_url ? null : (
          <span className="clinic-cover__empty">
            <Icon name="image" size={24} />
            No cover photograph yet
          </span>
        )}
      </div>
      <div className="clinic-cover__body">
        <span className="clinic-logo">
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt={`${clinic.clinic_name} logo`} />
          ) : (
            initials(clinic.clinic_name)
          )}
        </span>
        <div className="clinic-cover__titles">
          <h2 className="clinic-cover__name">{clinic.clinic_name}</h2>
          <p className="clinic-cover__meta">
            {[clinic.reference, location].filter(Boolean).join(' · ') || 'Reference not assigned'}
          </p>
        </div>
        <StatusBadge status={clinic.status} />
      </div>
    </section>
  );
}

/** Four-status breakdown drawn from the dashboard RPC counts. */
export function StatusChart({
  data,
}: {
  data: { label: string; value: number; tone?: 'brand' | 'warning' | 'success' | 'muted' }[];
}) {
  const max = Math.max(1, ...data.map((row) => row.value));

  return (
    <div className="split">
      {data.map((row) => (
        <div className="split__row" key={row.label}>
          <div className="split__head">
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
          <div className="split__track">
            <span
              className={`split__fill split__fill--${row.tone ?? 'brand'}`}
              style={{ width: `${Math.round((row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders the `operating_hours` jsonb the clinic saved. The shape only carries
 * one opening window (`opens` / `closes`) plus the days it applies to, so each
 * listed day shows that same window instead of inventing per-day hours.
 */
export function OperatingHoursList({ hours }: { hours: OperatingHours }) {
  if (!hours) {
    return <p className="muted">No operating hours have been recorded for this clinic.</p>;
  }

  const days = (hours.days ?? []).filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  const window = hours.opens && hours.closes ? `${hours.opens} – ${hours.closes}` : null;

  return (
    <div className="hours">
      {days.length ? (
        days.map((day) => (
          <div className="hours__row" key={day}>
            <span>{DAY_NAMES[day]}</span>
            <span className="hours__value">{window ?? 'Hours not set'}</span>
          </div>
        ))
      ) : (
        <div className="hours__row">
          <span>Opening hours</span>
          <span className="hours__value">{window ?? 'Hours not set'}</span>
        </div>
      )}
      {hours.note ? <p className="hours__note">{hours.note}</p> : null}
    </div>
  );
}

export function ClinicFooter({ right = 'Clinic-scoped by row-level security' }: { right?: string }) {
  return (
    <footer className="page__footer">
      <span>VetLink · Clinic administration · Live Supabase data</span>
      <span>{right}</span>
    </footer>
  );
}
