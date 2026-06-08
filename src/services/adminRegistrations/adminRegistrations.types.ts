import type { z } from 'zod';
import type {
  adminRegistrationExportQuerySchema,
  adminRegistrationListQuerySchema,
} from '../../validators/adminRegistrations.validator';

export type AdminRegistrationListQuery = z.infer<typeof adminRegistrationListQuerySchema>;
export type AdminRegistrationExportQuery = z.infer<typeof adminRegistrationExportQuerySchema>;

export interface AdminRegPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminRegistrationListItem {
  id: string;
  /** name + ' ' + surname from the Registration document */
  fullName: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  eventId: string | null;
  eventName: string | null;
  distanceLabel: string | null;
  bib: string | null;
  finalPrice: number | null;
  paymentStatus: 'pending' | 'completed' | 'failed';
  status: 'pending' | 'confirmed' | 'cancelled';
  registeredAt: Date;
}

export interface AdminRegistrationDetail extends AdminRegistrationListItem {
  city: string | null;
  runningClub: string | null;
  shirtSize: string | null;
  estimatedPace: string | null;
  promoCode: string | null;
  afuDonation: number | null;
  kidsRegistrations: KidRegistration[];
  userId: string | null;
  userName: string | null;
  payments: AdminRegPayment[];
}

export interface KidRegistration {
  kidId: string;
  name: string;
  age: number | null;
  distanceId: string | null;
  distanceLabel: string | null;
  shirtSize: string | null;
}

export interface CancelAdminRegistrationResult {
  registration: AdminRegistrationListItem;
  payments: AdminRegPayment[];
}
