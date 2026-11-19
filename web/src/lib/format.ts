/** Date, word and CSV helpers shared by the console screens. */

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return `${formatDate(value)} · ${formatTime(value)}`;
}

/** "3 days ago" for activity feeds; falls back to the date beyond a month. */
export function relativeTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return '—';
  const diff = date - Date.now();
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return relative(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 31) return relative(days, 'day');
  return formatDate(value);
}

function relative(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(value, unit);
}

export function fullName(person: { first_name?: string | null; last_name?: string | null }): string {
  const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
  return name || 'Unnamed account';
}

export function initials(first?: string | null, last?: string | null): string {
  const letters = `${first?.charAt(0) ?? ''}${last?.charAt(0) ?? ''}`.toUpperCase();
  return letters || 'VL';
}

export const STATUS_LABEL: Record<string, string> = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  suspended: 'Suspended',
  inactive: 'Inactive',
  active: 'Active',
  invited: 'Invitation pending',
  revoked: 'Revoked',
  pet_owner: 'Pet owner',
  clinic_administrator: 'Clinic administrator',
  receptionist: 'Appointment manager',
  veterinarian: 'Veterinarian',
  clinic_staff: 'Clinic staff',
  system_administrator: 'System administrator',
};

export function label(value?: string | null): string {
  if (!value) return '—';
  return STATUS_LABEL[value] ?? value.replace(/[._]/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** `clinic.rejected` → "Clinic rejected" for the audit log. */
export function humaniseAction(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function compactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en', { notation: value >= 10_000 ? 'compact' : 'standard' }).format(value);
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Downloads the rows the screen is already showing; nothing is generated server-side. */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
