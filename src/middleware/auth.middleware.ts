import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { UnauthorizedError } from '../types/errors';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

/**
 * Middleware to authenticate requests using JWT access token
 * Extracts token from Authorization header (Bearer scheme)
 * Verifies token and attaches userId to req.user
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
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
