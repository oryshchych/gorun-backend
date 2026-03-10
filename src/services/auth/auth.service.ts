import { RefreshToken } from '../../models/RefreshToken';
import { IUser, User } from '../../models/User';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../types/errors';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.util';
import type { AuthResponse, LoginInput, RegisterInput, UserResponse } from './auth.types';

export type { AuthResponse, LoginInput, RegisterInput, UserResponse } from './auth.types';

function formatUserResponse(user: IUser): UserResponse {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
    provider: user.provider,
    providerId: user.providerId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Register a new user
 * Creates user, hashes password, generates tokens, and stores refresh token
 */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const existingUser = await User.findOne({ email: input.email.toLowerCase() });
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  const user = new User({
    name: input.name,
    email: input.email.toLowerCase(),
    password: input.password,
    provider: 'credentials',
  });
  await user.save();

  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  });

  return {
    user: formatUserResponse(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Login an existing user
 * Verifies credentials, generates tokens, and stores refresh token
 */
export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await user.comparePassword(input.password);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = generateRefreshToken(user._id.toString());

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  });

  return {
    user: formatUserResponse(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh access token using refresh token
 * Verifies refresh token, generates new tokens, and invalidates old token
 */
export async function refreshAccessToken(refreshTokenString: string): Promise<AuthResponse> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenString);
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const storedToken = await RefreshToken.findOne({ token: refreshTokenString });
  if (!storedToken) {
    throw new UnauthorizedError('Refresh token not found or has been revoked');
  }

  if (storedToken.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    throw new UnauthorizedError('Refresh token has expired');
  }

  const user = await User.findById(payload.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const newAccessToken = generateAccessToken(user._id.toString());
  const newRefreshToken = generateRefreshToken(user._id.toString());

  await RefreshToken.deleteOne({ _id: storedToken._id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    userId: user._id,
    token: newRefreshToken,
    expiresAt,
  });

  return {
    user: formatUserResponse(user),
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout user by removing refresh token from database
 */
export async function logout(refreshTokenString: string): Promise<void> {
  const result = await RefreshToken.deleteOne({ token: refreshTokenString });

  if (result.deletedCount === 0) {
    throw new NotFoundError('Refresh token not found');
  }
}

/**
 * Get current user by ID
 */
export async function getCurrentUser(userId: string): Promise<UserResponse> {
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return formatUserResponse(user);
}

export default {
  register,
  login,
  refreshAccessToken,
  logout,
  getCurrentUser,
};
