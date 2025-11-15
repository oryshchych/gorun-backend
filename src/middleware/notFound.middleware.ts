import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../types/errors';

/**
 * Middleware to handle undefined routes (404)
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};
