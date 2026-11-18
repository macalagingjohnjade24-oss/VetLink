import type { Appointment } from '../data/mockAppointments';
import type { Clinic } from '../data/mockClinics';
import type { Pet } from '../data/mockPets';
import { appointmentService } from './appointmentService';
import { clinicService, type ServiceWithClinic } from './clinicService';
import { petService } from './petService';

export type SearchResults = {
  query: string;
  clinics: Clinic[];
  services: ServiceWithClinic[];
  pets: Pet[];
  appointments: Appointment[];
  total: number;
};

const matches = (haystack: string, query: string) => haystack.toLowerCase().includes(query.toLowerCase());

export const searchService = {
  /** Searches clinics, clinic services, the owner's pets and their appointments. */
  async search(rawQuery: string): Promise<SearchResults> {
    const query = rawQuery.trim();
    if (!query) {
      return { query, clinics: [], services: [], pets: [], appointments: [], total: 0 };
    }

    const [clinics, services, pets, appointments] = await Promise.all([
      clinicService.list(),
      clinicService.allServices(),
      petService.list(),
      appointmentService.list(),
    ]);

    const clinicResults = clinics.filter(
      (clinic) =>
        matches(clinic.name, query) ||
        matches(clinic.city, query) ||
        clinic.services.some((service) => matches(service.name, query)),
    );
    const serviceResults = services.filter(
      (service) => matches(service.name, query) || matches(service.description, query),
    );
    const petResults = pets.filter(
      (pet) => matches(pet.name, query) || matches(pet.breed, query) || matches(pet.species, query),
    );
    const appointmentResults = appointments.filter(
      (appointment) =>
        matches(appointment.serviceName, query) ||
        matches(appointment.reference, query) ||
        matches(appointment.status, query),
    );

    return {
      query,
      clinics: clinicResults,
      services: serviceResults,
      pets: petResults,
      appointments: appointmentResults,
      total: clinicResults.length + serviceResults.length + petResults.length + appointmentResults.length,
    };
  },
};
