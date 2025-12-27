import { Router } from 'express';
import {
  cancelRegistration,
  createPublicRegistration,
  getMyRegistrations,
  getRegistrations,
  processRefund,
} from '../controllers/registrations.controller';
import { authenticate } from '../middleware/auth.middleware';
import { registrationLimiter } from '../middleware/rateLimiter.middleware';
import { ValidationType, validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createPublicRegistrationSchema,
  getRegistrationsQuerySchema,
  refundSchema,
  registrationIdSchema,
} from '../validators/registrations.validator';

const router = Router();

/**
 * GET /api/registrations
 * Get all registrations with filters and pagination (requires authentication)
 */
router.get(
  '/',
  authenticate,
  validate(getRegistrationsQuerySchema, ValidationType.QUERY),
  asyncHandler(getRegistrations)
);

/**
 * GET /api/registrations/my
 * Get registrations for the authenticated user
 * Note: This must come before /:id to avoid route conflicts
 */
router.get(
  '/my',
  authenticate,
  validate(getRegistrationsQuerySchema, ValidationType.QUERY),
  asyncHandler(getMyRegistrations)
);

/**
 * POST /api/registrations
 * Create a new registration (public)
 */
router.post(
  '/',
  registrationLimiter,
  validate(createPublicRegistrationSchema, ValidationType.BODY),
  asyncHandler(createPublicRegistration)
);

/**
 * DELETE /api/registrations/:id
 * Cancel a registration (requires authentication)
 */
router.delete(
  '/:id',
  authenticate,
  validate(registrationIdSchema, ValidationType.PARAMS),
  asyncHandler(cancelRegistration)
);

/**
 * POST /api/registrations/:id/refund
 * Process refund for a registration (requires authentication)
 */
router.post(
  '/:id/refund',
  authenticate,
  validate(registrationIdSchema, ValidationType.PARAMS),
  validate(refundSchema, ValidationType.BODY),
  asyncHandler(processRefund)
);

export default router;
