import mongoose from 'mongoose';
import { jwtConfig } from '../../config/env';
import { IUser } from '../../models/User';
import { RefreshToken } from '../../models/RefreshToken';
import { expiryToDate } from '../../utils/time.util';
import { generateRefreshToken } from '../../utils/jwt.util';
import type { ProfileGender, UserResponse } from './auth.types';

export function formatUserResponse(user: IUser): UserResponse {
  const parts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  const derivedFirst = (user.firstName?.trim() || parts[0] || '').trim() || null;
  const derivedLast =
    (user.lastName?.trim() || (parts.length > 1 ? parts.slice(1).join(' ') : '') || '').trim() ||
    null;

  return {
    id: user._id.toString(),
    name: user.name,
    firstName: derivedFirst,
    lastName: derivedLast,
    phone: user.phone ?? null,
    email: user.email,
    dateOfBirth: user.dateOfBirth ?? null,
    gender: (user.gender as ProfileGender | undefined) ?? null,
    emergencyContactName: user.emergencyContactName ?? null,
    emergencyContactPhone: user.emergencyContactPhone ?? null,
    runningClub: user.runningClub ?? null,
    city: user.city ?? null,
    deliveryAddress: user.deliveryAddress ?? null,
    image: user.image ?? null,
    provider: user.provider,
    providerId: user.providerId ?? null,
    isAdmin: Boolean(user.isAdmin),
    adminRole: user.isAdmin && user.adminRole ? user.adminRole : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function persistRefreshToken(
  userId: mongoose.Types.ObjectId,
  refreshTokenJwt: string,
  longLived: boolean
): Promise<void> {
  const expiryStr = longLived ? jwtConfig.refreshExpiryLong : jwtConfig.refreshExpiry;
  const expiresAt = expiryToDate(expiryStr);
  await RefreshToken.create({
    userId,
    token: refreshTokenJwt,
    expiresAt,
    longLived,
  });
}

export function issueRefreshTokenJwt(userId: string, longLived: boolean): string {
  return generateRefreshToken(
    userId,
    longLived ? jwtConfig.refreshExpiryLong : jwtConfig.refreshExpiry
  );
}
