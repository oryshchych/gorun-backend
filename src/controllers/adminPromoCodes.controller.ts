import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import promoCodesService from '../services/promoCodes/promoCodes.service';
import type {
  CreateAdminPromoInput,
  AdminPromoListQuery,
  PatchAdminPromoInput,
} from '../services/promoCodes/promoCodes.service';
import { PROMO_CODES_CODES } from '../types/codes';

export const listAdminPromoCodes = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = req.validatedQuery as AdminPromoListQuery;
  const result = await promoCodesService.listAdminPromoCodes(q);

  res.status(200).json({
    success: true,
    code: PROMO_CODES_CODES.SUCCESS_PROMO_CODES_ADMIN_LIST_RETRIEVED,
    data: result.data,
    pagination: result.pagination,
  });
};

export const getAdminPromoCode = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const data = await promoCodesService.getAdminPromoCodeById(id);

  res.status(200).json({
    success: true,
    code: PROMO_CODES_CODES.SUCCESS_PROMO_CODE_RETRIEVED,
    data,
  });
};

export const createAdminPromoCode = async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as CreateAdminPromoInput;
  const data = await promoCodesService.createAdminPromoCode(body);

  res.status(201).json({
    success: true,
    code: PROMO_CODES_CODES.SUCCESS_PROMO_CODE_ADMIN_CREATED,
    data,
  });
};

export const patchAdminPromoCode = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const body = req.body as PatchAdminPromoInput;
  const data = await promoCodesService.patchAdminPromoCode(id, body);

  res.status(200).json({
    success: true,
    code: PROMO_CODES_CODES.SUCCESS_PROMO_CODE_ADMIN_UPDATED,
    data,
  });
};
