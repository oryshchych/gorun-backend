import { NextFunction, Request, Response } from 'express';
import { User } from '../models/User';
import { UnauthorizedError } from '../types/errors';
import { verifyAccessToken } from '../utils/jwt.util';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    /** Set after requireAdmin middleware */
    isAdmin?: boolean;
    adminRole?: 'admin' | 'super_admin' | null;
  };
}

/**
 * Middleware to authenticate requests using JWT access token
 * Extracts token from Authorization header (Bearer scheme)
 * Verifies token and attaches userId to req.user
 */
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('No authorization header provided');
    }

    // Check for Bearer scheme
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedError('Invalid authorization header format. Expected: Bearer <token>');
    }

    const token = parts[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify token and extract payload
    const payload = verifyAccessToken(token);

    // Attach userId to request
    req.user = {
      userId: payload.userId,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error instanceof Error) {
      // Handle JWT verification errors
      next(new UnauthorizedError(error.message));
    } else {
      next(new UnauthorizedError('Authentication failed'));
    }
  }
};

/**
 * Like authenticate but never rejects the request.
 * If a valid Bearer token is present the user context (including isAdmin) is
 * attached to req.user so downstream handlers can apply role-based logic.
 * Unauthenticated requests simply proceed without req.user set.
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      next();
      return;
    }

    const payload = verifyAccessToken(parts[1]);

    // Also load isAdmin so public list/detail routes can respect admin context
    const user = await User.findById(payload.userId).select('isAdmin adminRole deletedAt').lean();

    // Soft-deleted accounts get no admin context (treated as unauthenticated below)
    if (user?.deletedAt) {
      next();
      return;
    }

    req.user = {
      userId: payload.userId,
      isAdmin: user?.isAdmin ?? false,
      adminRole: user?.adminRole ?? null,
    };

    next();
  } catch {
    // Invalid / expired token — treat as unauthenticated
    next();
  }
};
