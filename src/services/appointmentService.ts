import { APPOINTMENTS, type Appointment } from '../data/mockAppointments';

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

export const appointmentService = {
  async list(): Promise<Appointment[]> {
    await wait();
    return APPOINTMENTS;
  },

  async upcoming(): Promise<Appointment[]> {
    await wait(150);
    return APPOINTMENTS.filter((a) => a.status === 'Confirmed' || a.status === 'Pending').sort((a, b) =>
      a.dateISO.localeCompare(b.dateISO),
    );
  },

  async getById(id: string): Promise<Appointment | null> {
    await wait(120);
    return APPOINTMENTS.find((appointment) => appointment.id === id) ?? null;
  },
};
