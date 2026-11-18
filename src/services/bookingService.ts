/** Mock availability for the booking workflow (no clinic scheduling system is connected yet). */

export const TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '3:30 PM', '4:30 PM'] as const;

const hash = (value: string) => {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total = (total * 31 + value.charCodeAt(i)) % 9973;
  return total;
};

export const bookingService = {
  /** Deterministic pseudo-availability so the same date always shows the same slots. */
  slotsFor(dateISO: string, clinicId: string): { time: string; available: boolean }[] {
    return TIME_SLOTS.map((time, index) => ({
      time,
      available: (hash(`${clinicId}-${dateISO}-${time}`) + index) % 4 !== 0,
    }));
  },

  /** Sundays and dates in the past cannot be requested. */
  isDateAvailable(date: Date, today = new Date()): boolean {
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date < midnight) return false;
    if (date.getDay() === 0) return false;
    return hash(date.toISOString().slice(0, 10)) % 7 !== 0;
  },

  buildReference(dateISO: string, existingCount: number): string {
    const date = new Date(dateISO);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `VL-${year}-${month}${day}-${String(existingCount + 1).padStart(2, '0')}`;
  },

  formatLongDate(dateISO: string): string {
    return new Date(dateISO).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  },

  formatShortDate(dateISO: string): string {
    return new Date(dateISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  monthLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },
};
