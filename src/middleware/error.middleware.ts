import { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Error as MongooseError } from 'mongoose';
import { serverConfig } from '../config/env';
import { logger } from '../config/logger';
import { AppError, ValidationError } from '../types/errors';
import { AuthRequest } from './auth.middleware';

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
  stack?: string;
}

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyPattern?: Record<string, number>;
}

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error,
  req: Request | AuthRequest,
  res: Response,
  _next: NextFunction
): void => {
  let error = err;

  // Handle Mongoose validation errors
  if (err instanceof MongooseError.ValidationError) {
    const errors: Record<string, string[]> = {};
    Object.keys(err.errors).forEach(key => {
      const errorField = err.errors[key];
      if (errorField) {
        errors[key] = [errorField.message];
      }
    });
    error = new ValidationError(errors);
  }

  // Handle Mongoose duplicate key errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    const mongoError = err as MongoDuplicateKeyError;
    if (mongoError.code === 11000) {
      const keyPattern = mongoError.keyPattern || {};
      const keys = Object.keys(keyPattern);

      // Build a more descriptive error message
      let fieldMessage = 'already exists';
      if (keys.length === 1) {
        fieldMessage = `${keys[0]} already exists`;
      } else if (keys.length > 1) {
        fieldMessage = `combination of ${keys.join(' and ')} already exists`;
      }

      // Use the first field for the error key, or a combined message
      const field = keys[0] || 'field';
      const errors: Record<string, string[]> = {
        [field]: [fieldMessage],
      };
      error = new ValidationError(errors);
    }
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
    userId: (req as AuthRequest).user?.userId,
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
    success: false,
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
