import type { UserAdminRole, UserGender } from '../../models/User';

export type AdminUserSource = 'all' | 'registered' | 'app_only';

export interface AdminUserListQuery {
  page: number;
  limit: number;
  search?: string;
  source?: AdminUserSource;
}

export interface AdminUserExportQuery {
  search?: string;
  source?: AdminUserSource;
}

/** Profile/contact fields an admin may edit. `null` clears an optional field. */
export interface UpdateAdminUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string;
  dateOfBirth?: string | null;
  gender?: UserGender | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  runningClub?: string | null;
  city?: string | null;
  deliveryAddress?: string | null;
}

export interface AdminUserListItem {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  registrationsCount: number;
  createdAt: Date;
}

export interface AdminUserRegistration {
  id: string;
  eventId: string | null;
  eventName: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed';
  distanceLabel: string | null;
  finalPrice: number | null;
  registeredAt: Date;
}

export interface AdminUserPayment {
  id: string;
  registrationId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserDetailResponse {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  image: string | null;
  provider: 'credentials' | 'google';
  dateOfBirth: string | null;
  gender: UserGender | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  runningClub: string | null;
  city: string | null;
  deliveryAddress: string | null;
  isAdmin: boolean;
  adminRole: UserAdminRole | null;
  createdAt: Date;
  updatedAt: Date;
  registrations: AdminUserRegistration[];
  payments: AdminUserPayment[];
}

export interface CancelRegistrationResult {
  registration: AdminUserRegistration;
  payments: AdminUserPayment[];
}
