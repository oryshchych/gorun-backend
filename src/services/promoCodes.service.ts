import mongoose from 'mongoose';
import { IPromoCode, PromoCode } from '../models/PromoCode';
import { PROMO_CODES_CODES } from '../types/codes';
import { NotFoundError, ValidationError } from '../types/errors';

class PromoCodesService {
  /**
   * Validate a promo code according to business rules
   */
  async validate(code: string, eventId?: string): Promise<IPromoCode> {
    const normalizedCode = code.toUpperCase().trim();
    const promoCode = await PromoCode.findOne({ code: normalizedCode });

    if (!promoCode) {
      throw new ValidationError(
        { promoCode: ['Invalid or expired promo code'] },
        PROMO_CODES_CODES.ERROR_PROMO_CODE_NOT_FOUND
      );
    }

    if (!promoCode.isActive) {
      throw new ValidationError(
        { promoCode: ['Invalid or expired promo code'] },
        PROMO_CODES_CODES.ERROR_PROMO_CODE_INVALID
      );
    }

    if (promoCode.usedCount >= promoCode.usageLimit) {
      throw new ValidationError(
        { promoCode: ['Promo code usage limit reached'] },
        PROMO_CODES_CODES.ERROR_PROMO_CODE_USAGE_LIMIT_REACHED
      );
    }

    if (promoCode.expirationDate && promoCode.expirationDate < new Date()) {
      throw new ValidationError(
        { promoCode: ['Promo code has expired'] },
        PROMO_CODES_CODES.ERROR_PROMO_CODE_EXPIRED
      );
    }

    if (promoCode.eventId && eventId) {
      if (!mongoose.Types.ObjectId.isValid(eventId) || promoCode.eventId.toString() !== eventId) {
        throw new ValidationError(
          { promoCode: ['Promo code is not valid for this event'] },
          PROMO_CODES_CODES.ERROR_PROMO_CODE_NOT_APPLICABLE
        );
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
      throw new NotFoundError('Promo code not found', PROMO_CODES_CODES.ERROR_PROMO_CODE_NOT_FOUND);
    }
  }

  /**
   * Decrement usedCount when a payment is refunded
   */
  async decrementUsage(promoCodeId: string, session?: mongoose.ClientSession): Promise<void> {
    const result = await PromoCode.updateOne(
      { _id: promoCodeId },
      { $inc: { usedCount: -1 } },
      session ? { session } : undefined
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Promo code not found', PROMO_CODES_CODES.ERROR_PROMO_CODE_NOT_FOUND);
    }

    // Ensure usedCount doesn't go below 0
    await PromoCode.updateOne(
      { _id: promoCodeId, usedCount: { $lt: 0 } },
      { $set: { usedCount: 0 } },
      session ? { session } : undefined
    );
  }
}

export default new PromoCodesService();
