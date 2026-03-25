export type ProfileGender = 'female' | 'male' | 'other' | 'prefer_not_to_say';

export interface RegisterInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** @deprecated Prefer firstName + lastName + phone */
  name?: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/** Full profile returned by GET/PATCH /api/auth/me and embedded in auth responses (stable keys; use null when unset). */
export interface UserResponse {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string;
  dateOfBirth: string | null;
  gender: ProfileGender | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  runningClub: string | null;
  city: string | null;
  deliveryAddress: string | null;
  image: string | null;
  provider: string;
  providerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}
