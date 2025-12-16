import { Router } from 'express';
import { validatePromoCode } from '../controllers/promoCodes.controller';
import { promoCodeLimiter } from '../middleware/rateLimiter.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { validatePromoCodeSchema } from '../validators/promoCodes.validator';

const router = Router();

router.post(
  '/validate',
  promoCodeLimiter,
  validate(validatePromoCodeSchema, ValidationType.BODY),
  asyncHandler(validatePromoCode)
);

export default router;
