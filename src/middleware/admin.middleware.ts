import { NextFunction, Response } from 'express';
import { User } from '../models/User';
import { AUTH_CODES } from '../types/codes';
import { ForbiddenError, UnauthorizedError } from '../types/errors';
import type { AuthRequest } from './auth.middleware';

/**
 * Requires authenticate middleware first. Allows only users with isAdmin === true.
 * Extends req.user with isAdmin and adminRole for handlers (optional use).
 * Future: narrow by adminRole without changing URL contract.
 */
export const requireAdmin = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      next(new UnauthorizedError('Authentication required', AUTH_CODES.ERROR_AUTH_UNAUTHORIZED));
      return;
    }

    const user = await User.findById(userId).select('isAdmin adminRole deletedAt');
    if (!user || user.deletedAt || !user.isAdmin) {
      next(new ForbiddenError('Admin access required', AUTH_CODES.ERROR_AUTH_ADMIN_REQUIRED));
      return;
    }

    req.user = {
      userId,
      isAdmin: true,
      adminRole: user.adminRole ?? 'admin',
    };
    next();
  } catch (err) {
    next(err);
  }
};
