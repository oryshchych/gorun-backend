import { authFlowConfig, frontendConfig } from '../../config/env';
import { logger } from '../../config/logger';
import { Event } from '../../models/Event';
import { PasswordResetToken } from '../../models/PasswordResetToken';
import { RefreshToken } from '../../models/RefreshToken';
import { Registration } from '../../models/Registration';
import { User } from '../../models/User';
import { AUTH_CODES, VALIDATION_CODES } from '../../types/codes';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../types/errors';
import { generateAccessToken, verifyRefreshToken } from '../../utils/jwt.util';
import { expiryToDate } from '../../utils/time.util';
import emailService from '../email/email.service';
import { randomUrlSafeToken, sha256Hex } from './auth.crypto';
import type { UpdateProfileInput } from '../../validators/auth.validator';
import { formatUserResponse, issueRefreshTokenJwt, persistRefreshToken } from './auth.helpers';
import type { AuthResponse, LoginInput, RegisterInput, UserResponse } from './auth.types';

export type { AuthResponse, LoginInput, RegisterInput, UserResponse } from './auth.types';
export type { UpdateProfileInput } from '../../validators/auth.validator';

function buildLegacyNameParts(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const firstName = tokens[0] ?? trimmed;
  const lastName = tokens.length > 1 ? tokens.slice(1).join(' ') : '—';
  return { firstName, lastName };
}

/**
 * Register a new user (credentials). Prefer firstName, lastName, phone (E.164); legacy `name` still supported.
 */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const email = input.email.toLowerCase();

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new ConflictError(
      'User with this email already exists',
      AUTH_CODES.ERROR_AUTH_EMAIL_EXISTS
    );
  }

  let firstName: string;
  let lastName: string;
  let phone: string | undefined;

  if (input.firstName && input.lastName && input.phone) {
    firstName = input.firstName.trim();
    lastName = input.lastName.trim();
    phone = input.phone.trim();
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      throw new ConflictError(
        'User with this phone number already exists',
        AUTH_CODES.ERROR_AUTH_PHONE_EXISTS
      );
    }
  } else if (input.name && input.name.trim().length >= 2) {
    const parts = buildLegacyNameParts(input.name);
    firstName = parts.firstName;
    lastName = parts.lastName;
    phone = input.phone?.trim();
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        throw new ConflictError(
          'User with this phone number already exists',
          AUTH_CODES.ERROR_AUTH_PHONE_EXISTS
        );
      }
    }
  } else {
    throw new ValidationError(
      {
        body: ['Provide firstName, lastName, phone or a valid name (legacy)'],
      },
      VALIDATION_CODES.ERROR_VALIDATION_FAILED
    );
  }

  const user = new User({
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    ...(phone ? { phone } : {}),
    email,
    password: input.password,
    provider: 'credentials',
  });
  await user.save();

  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = issueRefreshTokenJwt(user._id.toString(), false);
  await persistRefreshToken(user._id, refreshToken, false);

  return {
    user: formatUserResponse(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Login with optional rememberMe (longer refresh token TTL).
 */
export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await User.findOne({ email: input.email.toLowerCase(), deletedAt: null });
  if (!user) {
    throw new UnauthorizedError(
      'Invalid email or password',
      AUTH_CODES.ERROR_AUTH_INVALID_CREDENTIALS
    );
  }

  const isPasswordValid = await user.comparePassword(input.password);
  if (!isPasswordValid) {
    throw new UnauthorizedError(
      'Invalid email or password',
      AUTH_CODES.ERROR_AUTH_INVALID_CREDENTIALS
    );
  }

  const longLived = Boolean(input.rememberMe);
  const accessToken = generateAccessToken(user._id.toString());
  const refreshToken = issueRefreshTokenJwt(user._id.toString(), longLived);
  await persistRefreshToken(user._id, refreshToken, longLived);

  return {
    user: formatUserResponse(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh access token; preserves short vs long refresh TTL based on stored session.
 */
export async function refreshAccessToken(refreshTokenString: string): Promise<AuthResponse> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenString);
  } catch {
    throw new UnauthorizedError(
      'Invalid or expired refresh token',
      AUTH_CODES.ERROR_AUTH_REFRESH_TOKEN_INVALID
    );
  }

  const storedToken = await RefreshToken.findOne({ token: refreshTokenString });
  if (!storedToken) {
    throw new UnauthorizedError(
      'Refresh token not found or has been revoked',
      AUTH_CODES.ERROR_AUTH_REFRESH_TOKEN_INVALID
    );
  }

  if (storedToken.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    throw new UnauthorizedError('Refresh token has expired', AUTH_CODES.ERROR_AUTH_TOKEN_EXPIRED);
  }

  const user = await User.findById(payload.userId);
  if (!user || user.deletedAt) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    throw new NotFoundError('User not found', AUTH_CODES.ERROR_AUTH_USER_NOT_FOUND);
  }

  const longLived = Boolean(storedToken.longLived);
  const newAccessToken = generateAccessToken(user._id.toString());
  const newRefreshToken = issueRefreshTokenJwt(user._id.toString(), longLived);

  await RefreshToken.deleteOne({ _id: storedToken._id });
  await persistRefreshToken(user._id, newRefreshToken, longLived);

  return {
    user: formatUserResponse(user),
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logout(refreshTokenString: string): Promise<void> {
  const result = await RefreshToken.deleteOne({ token: refreshTokenString });

  if (result.deletedCount === 0) {
    throw new NotFoundError('Refresh token not found', AUTH_CODES.ERROR_AUTH_REFRESH_TOKEN_INVALID);
  }
}

/**
 * Aggregated profile stats for the runner: km logged across confirmed
 * registrations and total UAH donated to the AFU.
 *
 * `totalKm` joins each registration's event by `distanceId` to find the
 * distance.km. Falls back to 0 when the event/distance can't be resolved.
 */
async function computeUserStats(
  userId: string
): Promise<{ totalKm: number; totalDonated: number }> {
  const regs = await Registration.find({ userId, status: 'confirmed' })
    .select('afuDonation distanceId eventId')
    .lean();

  let totalDonated = 0;
  const eventIds = new Set<string>();
  for (const r of regs) {
    const reg = r as { afuDonation?: number; eventId?: { toString(): string } };
    if (reg.afuDonation) totalDonated += reg.afuDonation;
    if (reg.eventId) eventIds.add(reg.eventId.toString());
  }

  let totalKm = 0;
  if (eventIds.size > 0) {
    const events = await Event.find({ _id: { $in: Array.from(eventIds) } })
      .select('distances')
      .lean();
    const kmByEventDistance = new Map<string, number>();
    for (const ev of events) {
      const eid = (ev as { _id: { toString(): string } })._id.toString();
      const distances = (ev as { distances?: Array<{ id?: string; km?: number }> }).distances ?? [];
      for (const d of distances) {
        if (d.id && typeof d.km === 'number') {
          kmByEventDistance.set(`${eid}:${d.id}`, d.km);
        }
      }
    }
    for (const r of regs) {
      const reg = r as { distanceId?: string; eventId?: { toString(): string } };
      if (reg.distanceId && reg.eventId) {
        const key = `${reg.eventId.toString()}:${reg.distanceId}`;
        const km = kmByEventDistance.get(key);
        if (typeof km === 'number') totalKm += km;
      }
    }
  }

  return { totalKm, totalDonated };
}

export async function getCurrentUser(userId: string): Promise<UserResponse> {
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('User not found', AUTH_CODES.ERROR_AUTH_USER_NOT_FOUND);
  }

  const stats = await computeUserStats(userId);
  return formatUserResponse(user, stats);
}

/**
 * Partial profile update. Omit keys to leave unchanged; null clears a field.
 * email is not patchable (rejected by schema .strict() if sent).
 */
export async function updateProfile(
  userId: string,
  patch: UpdateProfileInput
): Promise<UserResponse> {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found', AUTH_CODES.ERROR_AUTH_USER_NOT_FOUND);
  }

  if (Object.keys(patch).length === 0) {
    return formatUserResponse(user);
  }

  if ('phone' in patch) {
    if (patch.phone === null) {
      user.set('phone', undefined);
    } else if (patch.phone !== undefined) {
      const newPhone = patch.phone;
      const existing = await User.findOne({ phone: newPhone, _id: { $ne: user._id } });
      if (existing) {
        throw new ConflictError(
          'User with this phone number already exists',
          AUTH_CODES.ERROR_AUTH_PHONE_EXISTS
        );
      }
      user.phone = newPhone;
    }
  }

  const assignKeys = [
    'firstName',
    'lastName',
    'dateOfBirth',
    'gender',
    'emergencyContactName',
    'emergencyContactPhone',
    'runningClub',
    'city',
    'deliveryAddress',
  ] as const;

  for (const key of assignKeys) {
    if (!(key in patch)) continue;
    const val = patch[key];
    if (val === null) {
      user.set(key, undefined);
    } else if (val !== undefined) {
      (user as unknown as Record<string, unknown>)[key] = val;
    }
  }

  if ('kids' in patch && patch.kids !== undefined) {
    (user as unknown as Record<string, unknown>).kids = patch.kids;
  }

  await user.save();
  const stats = await computeUserStats(userId);
  return formatUserResponse(user, stats);
}

/**
 * Request password reset (always appears successful to avoid email enumeration).
 */
export async function forgotPassword(email: string, locale?: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    logger.info('Forgot password requested for unknown email');
    return;
  }

  await PasswordResetToken.deleteMany({ userId: user._id });

  const raw = randomUrlSafeToken(32);
  const tokenHash = sha256Hex(raw);
  const expiresAt = expiryToDate(authFlowConfig.passwordResetTokenExpiry);

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  const base = frontendConfig.url.replace(/\/$/, '');
  const loc = locale && /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? `/${locale}` : '';
  const resetLink = `${base}${loc}/reset-password?token=${encodeURIComponent(raw)}`;

  if (user.email) {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      resetLink,
      locale: locale ?? 'uk',
    });
  }
}

/**
 * Reset password using token from email.
 */
export async function resetPassword(
  token: string,
  password: string,
  confirmPassword: string
): Promise<void> {
  if (password !== confirmPassword) {
    throw new ValidationError(
      { confirmPassword: ['Passwords do not match'] },
      VALIDATION_CODES.ERROR_VALIDATION_FAILED
    );
  }

  const tokenHash = sha256Hex(token);
  const record = await PasswordResetToken.findOne({ tokenHash });
  if (!record || record.expiresAt < new Date()) {
    if (record) await PasswordResetToken.deleteOne({ _id: record._id });
    throw new ValidationError(
      { token: ['Invalid or expired reset token'] },
      AUTH_CODES.ERROR_AUTH_RESET_TOKEN_INVALID
    );
  }

  const user = await User.findById(record.userId);
  if (!user) {
    await PasswordResetToken.deleteOne({ _id: record._id });
    throw new NotFoundError('User not found', AUTH_CODES.ERROR_AUTH_USER_NOT_FOUND);
  }

  user.password = password;
  await user.save();

  await PasswordResetToken.deleteMany({ userId: user._id });
  await RefreshToken.deleteMany({ userId: user._id });
}

export default {
  register,
  login,
  refreshAccessToken,
  logout,
  getCurrentUser,
  updateProfile,
  forgotPassword,
  resetPassword,
};
