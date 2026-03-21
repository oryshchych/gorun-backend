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

export interface UserResponse {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email: string;
  image?: string | undefined;
  provider: string;
  providerId?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}
