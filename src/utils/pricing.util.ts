import { IPromoCode } from '../models/PromoCode';

export interface PriceBreakdown {
  finalPrice: number;
  discountAmount: number;
}

export const calculatePrice = (
  basePrice: number,
  promoCode?: IPromoCode | null
): PriceBreakdown => {
  if (!promoCode || !promoCode.isActive) {
    return { finalPrice: Math.max(0, basePrice), discountAmount: 0 };
  }

  let discountAmount = 0;

  if (promoCode.discountType === 'percentage') {
    discountAmount = (basePrice * promoCode.discountValue) / 100;
  } else if (promoCode.discountType === 'amount') {
    discountAmount = promoCode.discountValue;
  }

  const finalPrice = Math.max(0, basePrice - discountAmount);

  return { finalPrice, discountAmount };
};
