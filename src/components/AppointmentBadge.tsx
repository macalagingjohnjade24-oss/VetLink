import type { AppointmentStatus } from '../data/mockAppointments';
import { Badge, type BadgeTone } from './Badge';

export const appointmentTone: Record<AppointmentStatus, BadgeTone> = {
  Pending: 'warning',
  Confirmed: 'success',
  'Reschedule requested': 'info',
  'Cancellation requested': 'warning',
  Completed: 'neutral',
  Cancelled: 'danger',
  Rejected: 'danger',
};

export const statusDescription: Record<AppointmentStatus, string> = {
  Pending: 'Your request is waiting for clinic approval.',
  Confirmed: 'The clinic has approved the date and time.',
  'Reschedule requested':
    'A new time has been requested. The current booking remains active until approval.',
  'Cancellation requested': 'The clinic has been asked to cancel. The visit stands until they confirm.',
  Completed: 'The clinic has marked the visit as complete.',
  Cancelled: 'The appointment has been cancelled.',
  Rejected: 'The clinic could not accept the request. Choose another available slot.',
};

/** Statuses in the order the guide shows them (also the source of truth for the list). */
export const APPOINTMENT_STATUSES = Object.keys(appointmentTone) as AppointmentStatus[];

/** Terminal states: no reschedule or cancellation offered any more. */
export function isClosedStatus(status: AppointmentStatus): boolean {
  return status === 'Completed' || status === 'Cancelled' || status === 'Rejected';
}

/** Requests the clinic still has to answer. */
export function isAwaitingClinic(status: AppointmentStatus): boolean {
  return (
    status === 'Pending' || status === 'Reschedule requested' || status === 'Cancellation requested'
  );
}

export function AppointmentBadge({ status }: { status: AppointmentStatus }) {
  return <Badge label={status} tone={appointmentTone[status]} />;
}
