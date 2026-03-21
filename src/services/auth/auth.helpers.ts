import mongoose from 'mongoose';
import { jwtConfig } from '../../config/env';
import { RefreshToken } from '../../models/RefreshToken';
import { IUser } from '../../models/User';
import { generateRefreshToken } from '../../utils/jwt.util';
import { expiryToDate } from '../../utils/time.util';
import type { UserResponse } from './auth.types';

export function formatUserResponse(user: IUser): UserResponse {
  const parts = (user.name || '').trim().split(/\s+/).filter(Boolean);
  const derivedFirst = (user.firstName ?? parts[0] ?? '').trim();
  const derivedLast = (user.lastName ?? (parts.length > 1 ? parts.slice(1).join(' ') : '')).trim();

  const out: UserResponse = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    provider: user.provider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (derivedFirst) out.firstName = derivedFirst;
  if (derivedLast) out.lastName = derivedLast;
  if (user.phone) out.phone = user.phone;
  if (user.image) out.image = user.image;
  if (user.providerId) out.providerId = user.providerId;

  return out;
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
