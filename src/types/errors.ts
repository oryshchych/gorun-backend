import { ErrorCode } from './codes';

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: ErrorCode;

  constructor(message: string, statusCode: number, code: ErrorCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error with field-level details (400)
 */
export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(
    errors: Record<string, string[]>,
    code: ErrorCode = 'ERROR_VALIDATION_FAILED' as ErrorCode
  ) {
    super('Validation failed', 400, code);
    this.errors = errors;
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(
    message: string = 'Unauthorized',
    code: ErrorCode = 'ERROR_AUTH_UNAUTHORIZED' as ErrorCode
  ) {
    super(message, 401, code);
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code: ErrorCode = 'ERROR_FORBIDDEN' as ErrorCode) {
    super(message, 403, code);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    code: ErrorCode = 'ERROR_NOT_FOUND' as ErrorCode
  ) {
    super(message, 404, code);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code: ErrorCode = 'ERROR_BAD_REQUEST' as ErrorCode) {
    super(message, 409, code);
  }
}
