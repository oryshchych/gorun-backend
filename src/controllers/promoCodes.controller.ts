import { Request, Response } from 'express';
import promoCodesService from '../services/promoCodes.service';
import { PROMO_CODES_CODES } from '../types/codes';

export const validatePromoCode = async (req: Request, res: Response): Promise<void> => {
  const { code, eventId } = req.body;

  const promo = await promoCodesService.validate(code, eventId);

  res.status(200).json({
    success: true,
    code: PROMO_CODES_CODES.SUCCESS_PROMO_CODE_VALIDATED,
    data: {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      isValid: true,
    },
  });
};
