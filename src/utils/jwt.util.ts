import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/env';

export interface JWTPayload {
  userId: string;
}

/**
 * Generate an access token with 15 minute expiry
 */
export const generateAccessToken = (userId: string): string => {
  const payload: JWTPayload = { userId };
  return jwt.sign(payload, jwtConfig.accessSecret, {
    expiresIn: jwtConfig.accessExpiry,
  });
};

/**
 * Generate a refresh token with 7 day expiry
 */
export const generateRefreshToken = (userId: string): string => {
  const payload: JWTPayload = { userId };
  return jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiry,
  });
};

/**
 * Verify an access token and return the payload
 * @throws Error if token is invalid or expired
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, jwtConfig.accessSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw new Error('Token verification failed');
  }
};

/**
 * Verify a refresh token and return the payload
 * @throws Error if token is invalid or expired
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, jwtConfig.refreshSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw new Error('Token verification failed');
  }
};
