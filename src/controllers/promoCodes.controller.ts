import { Request, Response } from 'express';
import promoCodesService from '../services/promoCodes.service';

export const validatePromoCode = async (req: Request, res: Response): Promise<void> => {
  const { code, eventId } = req.body;

  const promo = await promoCodesService.validate(code, eventId);

  res.status(200).json({
    success: true,
    data: {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      isValid: true,
    },
  });
};
