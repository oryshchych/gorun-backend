import { Router } from 'express';
import {
  createAdminPromoCode,
  getAdminPromoCode,
  listAdminPromoCodes,
  patchAdminPromoCode,
} from '../controllers/adminPromoCodes.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  adminPromoCreateBodySchema,
  adminPromoIdParamSchema,
  adminPromoListQuerySchema,
  adminPromoPatchBodySchema,
} from '../validators/adminPromoCodes.validator';

const router = Router();

router.use(authenticate, requireAdmin);

router.get(
  '/',
  validate(adminPromoListQuerySchema, ValidationType.QUERY, { statusCode: 422 }),
  asyncHandler(listAdminPromoCodes)
);

router.get(
  '/:id',
  validate(adminPromoIdParamSchema, ValidationType.PARAMS, { statusCode: 422 }),
  asyncHandler(getAdminPromoCode)
);

router.post(
  '/',
  validate(adminPromoCreateBodySchema, ValidationType.BODY, { statusCode: 422 }),
  asyncHandler(createAdminPromoCode)
);

router.patch(
  '/:id',
  validate(adminPromoIdParamSchema, ValidationType.PARAMS, { statusCode: 422 }),
  validate(adminPromoPatchBodySchema, ValidationType.BODY, { statusCode: 422 }),
  asyncHandler(patchAdminPromoCode)
);

export default router;
