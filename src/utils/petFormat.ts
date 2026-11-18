/** Age label shown on pet cards and profile headers ("3 years", "7 months"). */
export function ageLabelFrom(birthDateISO: string): string {
  const birth = new Date(birthDateISO);
  if (Number.isNaN(birth.getTime())) return 'Age unknown';
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return 'Age unknown';
  if (months < 12) return `${Math.max(months, 1)} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'}`;
}

export function formatBirthDate(birthDateISO: string): string {
  const date = new Date(birthDateISO);
  if (Number.isNaN(date.getTime())) return 'Not added';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** `2026-11-18` (date column) → `Nov 18, 2026` for appointment summaries. */
export function formatISODate(dateISO: string | null | undefined): string {
  if (!dateISO) return '—';
  const date = new Date(`${dateISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** `10:00:00` (time column) → `10:00 AM`. */
export function formatTimeLabel(time: string | null | undefined): string {
  if (!time) return '—';
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = minutesRaw ?? '00';
  if (Number.isNaN(hours)) return time;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const padded = String(hours % 12 === 0 ? 12 : hours % 12).padStart(2, '0');
  return `${padded}:${minutes.slice(0, 2)} ${suffix}`;
}

/** `10:00 AM` (app label) → `10:00:00` (time column). */
export function timeLabelToISO(label: string): string {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '09:00:00';
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return `${String(hours).padStart(2, '0')}:${match[2]}:00`;
}
