import { Router } from 'express';
import { checkPaymentStatus, getPaymentReceipt } from '../controllers/payments.controller';
import { authenticate } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimiter.middleware';
import { ValidationType, validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { paymentIdSchema } from '../validators/payments.validator';

const router = Router();

/**
 * GET /api/payments/:id/status
 * Check payment status from Monobank API (fallback)
 */
router.get(
  '/:id/status',
  authenticate,
  apiLimiter,
  validate(paymentIdSchema, ValidationType.PARAMS),
  asyncHandler(checkPaymentStatus)
);

/**
 * GET /api/payments/:id/receipt
 * Get receipt for a payment
 */
router.get(
  '/:id/receipt',
  authenticate,
  apiLimiter,
  validate(paymentIdSchema, ValidationType.PARAMS),
  asyncHandler(getPaymentReceipt)
);

export default router;
