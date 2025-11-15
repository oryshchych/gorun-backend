import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '../config/logger';
import { serverConfig } from '../config/env';
import { AppError, ValidationError } from '../types/errors';

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
  stack?: string;
}

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = err;

  // Handle Mongoose validation errors
  if (err instanceof MongooseError.ValidationError) {
    const errors: Record<string, string[]> = {};
    Object.keys(err.errors).forEach((key) => {
      errors[key] = [err.errors[key].message];
    });
    error = new ValidationError(errors);
  }

  // Handle Mongoose duplicate key errors
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern || {})[0] || 'field';
    const errors: Record<string, string[]> = {
      [field]: [`${field} already exists`],
    };
    error = new ValidationError(errors);
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err instanceof MongooseError.CastError) {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  // Handle JWT errors
  if (err instanceof TokenExpiredError) {
    error = new AppError('Token has expired', 401);
  }

  if (err instanceof JsonWebTokenError) {
    error = new AppError('Invalid token', 401);
  }

  // Default to 500 server error if not an operational error
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : 'Internal server error';

  // Log error
  const logMessage = `${req.method} ${req.path} - ${statusCode} - ${message}`;
  const logMeta = {
    method: req.method,
    path: req.path,
    statusCode,
    ip: req.ip,
    userId: (req as any).user?.userId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  };

  if (statusCode >= 500) {
    logger.error(logMessage, logMeta);
  } else {
    logger.warn(logMessage, logMeta);
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: err.name || 'Error',
    message,
    statusCode,
  };

  // Add validation errors if present
  if (error instanceof ValidationError) {
    errorResponse.errors = error.errors;
  }

  // Include stack trace in development
  if (serverConfig.nodeEnv === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};
