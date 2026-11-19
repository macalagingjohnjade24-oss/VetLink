import { useEffect, type ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/Icon';
import { label } from '@/lib/format';
import type { TrendPoint } from '@/sa/data';

/** Title + subtitle row used at the top of every console page. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page__header">
      <div>
        <h1 className="page__title">{title}</h1>
        {subtitle ? <p className="page__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page__actions">{actions}</div> : null}
    </header>
  );
}

export function Stat({
  label: statLabel,
  value,
  note,
  muted,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="stat">
      <span className="stat__label">{statLabel}</span>
      <span className={`stat__value${muted ? ' stat__value--muted' : ''}`}>{value}</span>
      {note ? <span className="stat__note">{note}</span> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  flush,
}: {
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="panel">
      {title ? (
        <div className="panel__head">
          <div>
            <h2 className="panel__title">{title}</h2>
            {subtitle ? <p className="panel__sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="page__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={`panel__body${flush ? ' panel__body--flush' : ''}`}>{children}</div>
    </section>
  );
}

const TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  approved: 'success',
  active: 'success',
  pending: 'warning',
  invited: 'warning',
  information_required: 'warning',
  rejected: 'danger',
  suspended: 'danger',
  inactive: 'neutral',
  revoked: 'neutral',
  pet_owner: 'neutral',
};

export function StatusBadge({
  status,
  tone,
  children,
}: {
  status: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  children?: ReactNode;
}) {
  return (
    <span className={`badge badge--${tone ?? TONES[status] ?? 'neutral'}`}>
      {children ?? label(status)}
    </span>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  label: fieldLabel = 'Search',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="control">
      <label className="control__label" htmlFor={`search-${fieldLabel}`}>
        {fieldLabel}
      </label>
      <div className="control__box">
        <Icon name="search" size={16} />
        <input
          id={`search-${fieldLabel}`}
          className="control__input"
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export function SelectField({
  label: fieldLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="control">
      <label className="control__label" htmlFor={`select-${fieldLabel}`}>
        {fieldLabel}
      </label>
      <select
        id={`select-${fieldLabel}`}
        className="control__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pager">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="pager__buttons">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = 'search',
  action,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <span className="state__icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="state__title">{title}</p>
      {description ? <p className="state__copy">{description}</p> : null}
      {action}
    </div>
  );
}

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack--sm" style={{ padding: 20 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton" style={{ width: `${90 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <span className="state__icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
        <Icon name="alert" size={22} />
      </span>
      <p className="state__title">That data could not be loaded</p>
      <p className="state__copy">{message}</p>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry} style={{ marginTop: 10 }}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
}) {
  return (
    <div className={`alert alert--${tone}`}>
      <Icon name={tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'shield'} size={18} />
      <span>{children}</span>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  busy,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger' | 'outline';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="dialog"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="dialog__card" role="dialog" aria-modal="true" aria-label={title}>
        <p className="dialog__title">{title}</p>
        {description ? <p className="dialog__body">{description}</p> : null}
        {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
        <div className="dialog__actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Bars({ data }: { data: TrendPoint[] }) {
  const max = Math.max(1, ...data.map((point) => point.value));

  return (
    <div className="bars">
      {data.map((point, index) => {
        const isCurrent = index === data.length - 1;
        const height = Math.max(6, Math.round((point.value / max) * 148));
        return (
          <div className="bars__col" key={`${point.label}-${index}`}>
            <span className="bars__value">{point.value}</span>
            <div
              className={`bars__track${isCurrent ? ' bars__track--current' : ''}`}
              style={{ height }}
            />
            <span className="bars__label">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DetailRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function Metric({ label: metricLabel, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <p className="metric__label">{metricLabel}</p>
      <p className="metric__value">{value}</p>
    </div>
  );
}

export function ConsoleFooter({ right = 'Privileged actions are audited' }: { right?: string }) {
  return (
    <footer className="page__footer">
      <span>VetLink · Platform administration · Live Supabase data</span>
      <span>{right}</span>
    </footer>
  );
}
