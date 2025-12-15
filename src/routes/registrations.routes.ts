import { Router } from 'express';
import {
  getRegistrations,
  getMyRegistrations,
  createPublicRegistration,
  cancelRegistration,
} from '../controllers/registrations.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import {
  createPublicRegistrationSchema,
  registrationIdSchema,
  getRegistrationsQuerySchema,
} from '../validators/registrations.validator';
import { asyncHandler } from '../utils/asyncHandler';
import { registrationLimiter } from '../middleware/rateLimiter.middleware';

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

export default router;
