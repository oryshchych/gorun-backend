import mongoose from 'mongoose';
import { IPromoCode, PromoCode } from '../models/PromoCode';
import { NotFoundError, ValidationError } from '../types/errors';

class PromoCodesService {
  /**
   * Validate a promo code according to business rules
   */
  async validate(code: string, eventId?: string): Promise<IPromoCode> {
    const normalizedCode = code.toUpperCase().trim();
    const promoCode = await PromoCode.findOne({ code: normalizedCode });

    if (!promoCode) {
      throw new ValidationError({ promoCode: ['Invalid or expired promo code'] });
    }

    if (!promoCode.isActive) {
      throw new ValidationError({ promoCode: ['Invalid or expired promo code'] });
    }

    if (promoCode.usedCount >= promoCode.usageLimit) {
      throw new ValidationError({ promoCode: ['Promo code usage limit reached'] });
    }

    if (promoCode.expirationDate && promoCode.expirationDate < new Date()) {
      throw new ValidationError({ promoCode: ['Promo code has expired'] });
    }

    if (promoCode.eventId && eventId) {
      if (!mongoose.Types.ObjectId.isValid(eventId) || promoCode.eventId.toString() !== eventId) {
        throw new ValidationError({ promoCode: ['Promo code is not valid for this event'] });
      }
    }

    return promoCode;
  }

  /**
   * Increment usedCount when a promo code is redeemed
   */
  async incrementUsage(promoCodeId: string, session?: mongoose.ClientSession): Promise<void> {
    const result = await PromoCode.updateOne(
      { _id: promoCodeId },
      { $inc: { usedCount: 1 } },
      session ? { session } : undefined
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Promo code not found');
    }
  }
}

export default new PromoCodesService();
