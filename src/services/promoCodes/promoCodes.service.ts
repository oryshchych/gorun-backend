import mongoose from 'mongoose';
import { Event } from '../../models/Event';
import { IPromoCode, PromoCode } from '../../models/PromoCode';
import { EVENTS_CODES, PROMO_CODES_CODES, VALIDATION_CODES } from '../../types/codes';
import { ConflictError, NotFoundError, ValidationError } from '../../types/errors';
import {
  PaginatedResponse,
  formatPaginatedResponse,
  getPaginationParams,
} from '../../utils/pagination.util';

const ADMIN_VALIDATION_STATUS = 422;

function assertDiscountConsistent(
  discountType: 'percentage' | 'amount',
  discountValue: number
): void {
  const fieldErrors: Record<string, string[]> = {};
  if (discountType === 'percentage' && discountValue > 100) {
    fieldErrors.discountValue = ['Percentage discount cannot exceed 100'];
  }
  if (discountType === 'amount' && discountValue <= 0) {
    fieldErrors.discountValue = ['Fixed discount must be greater than 0'];
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(
      fieldErrors,
      VALIDATION_CODES.ERROR_VALIDATION_FAILED,
      ADMIN_VALIDATION_STATUS
    );
  }
}

function toApiDiscountType(t: 'percentage' | 'amount'): 'percentage' | 'fixed' {
  return t === 'amount' ? 'fixed' : 'percentage';
}

export interface AdminPromoCodeResponse {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  eventId: string | null;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  expirationDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function formatAdminPromo(doc: IPromoCode): AdminPromoCodeResponse {
  return {
    id: doc._id.toString(),
    code: doc.code,
    discountType: toApiDiscountType(doc.discountType),
    discountValue: doc.discountValue,
    eventId: doc.eventId ? doc.eventId.toString() : null,
    isActive: doc.isActive,
    usageLimit: doc.usageLimit ?? null,
    usedCount: doc.usedCount,
    expirationDate: doc.expirationDate ? doc.expirationDate.toISOString() : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export interface AdminPromoListQuery {
  page: number;
  limit: number;
  eventId?: string;
  isActive?: 'true' | 'false';
  search?: string;
}

export interface CreateAdminPromoInput {
  code: string;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  eventId: string;
  isActive: boolean;
  usageLimit?: number | null;
  expirationDate?: string | null;
}

export interface PatchAdminPromoInput {
  code?: string;
  discountType?: 'percentage' | 'amount';
  discountValue?: number;
  eventId?: string;
  isActive?: boolean;
  usageLimit?: number | null;
  expirationDate?: string | null;
}

/**
 * Validate a promo code according to business rules
 */
export async function validate(code: string, eventId?: string): Promise<IPromoCode> {
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

  if (promoCode.usageLimit != null && promoCode.usedCount >= promoCode.usageLimit) {
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
export async function incrementUsage(
  promoCodeId: string,
  session?: mongoose.ClientSession
): Promise<void> {
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
export async function decrementUsage(
  promoCodeId: string,
  session?: mongoose.ClientSession
): Promise<void> {
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

export async function listAdminPromoCodes(
  query: AdminPromoListQuery
): Promise<PaginatedResponse<AdminPromoCodeResponse>> {
  const { page, limit, skip } = getPaginationParams(query.page, query.limit);
  const filter: mongoose.FilterQuery<IPromoCode> = {};
  if (query.eventId) {
    filter.eventId = new mongoose.Types.ObjectId(query.eventId);
  }
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true';
  }
  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.code = new RegExp(escaped, 'i');
  }

  const total = await PromoCode.countDocuments(filter);
  const docs = await PromoCode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

  const data = docs.map(d => formatAdminPromo(d));
  return formatPaginatedResponse(data, total, page, limit);
}

export async function getAdminPromoCodeById(id: string): Promise<AdminPromoCodeResponse> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('Promo code not found', PROMO_CODES_CODES.ERROR_PROMO_CODE_NOT_FOUND);
  }
  const doc = await PromoCode.findById(id);
  if (!doc) {
    throw new NotFoundError('Promo code not found', PROMO_CODES_CODES.ERROR_PROMO_CODE_NOT_FOUND);
  }
  return formatAdminPromo(doc);
}

export async function createAdminPromoCode(
  body: CreateAdminPromoInput
): Promise<AdminPromoCodeResponse> {
  const existing = await PromoCode.findOne({ code: body.code });
  if (existing) {
    throw new ConflictError(
      'Promo code already exists',
      PROMO_CODES_CODES.ERROR_PROMO_CODE_DUPLICATE
    );
  }

  const event = await Event.findById(body.eventId);
  if (!event) {
    throw new NotFoundError('Event not found', EVENTS_CODES.ERROR_EVENTS_NOT_FOUND);
  }

  assertDiscountConsistent(body.discountType, body.discountValue);

  const doc = await PromoCode.create({
    code: body.code,
    discountType: body.discountType,
    discountValue: body.discountValue,
    eventId: new mongoose.Types.ObjectId(body.eventId),
    isActive: body.isActive,
    usedCount: 0,
    ...(body.usageLimit != null ? { usageLimit: body.usageLimit } : {}),
    ...(body.expirationDate ? { expirationDate: new Date(body.expirationDate) } : {}),
  });

  return formatAdminPromo(doc);
}

export async function patchAdminPromoCode(
  id: string,
  patch: PatchAdminPromoInput
): Promise<AdminPromoCodeResponse> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('Promo code not found', PROMO_CODES_CODES.ERROR_PROMO_CODE_NOT_FOUND);
  }
  const doc = await PromoCode.findById(id);
  if (!doc) {
    throw new NotFoundError('Promo code not found', PROMO_CODES_CODES.ERROR_PROMO_CODE_NOT_FOUND);
  }

  if (patch.code !== undefined && patch.code !== doc.code) {
    const taken = await PromoCode.findOne({ code: patch.code, _id: { $ne: doc._id } });
    if (taken) {
      throw new ConflictError(
        'Promo code already exists',
        PROMO_CODES_CODES.ERROR_PROMO_CODE_DUPLICATE
      );
    }
    doc.code = patch.code;
  }

  if (patch.eventId !== undefined) {
    const event = await Event.findById(patch.eventId);
    if (!event) {
      throw new NotFoundError('Event not found', EVENTS_CODES.ERROR_EVENTS_NOT_FOUND);
    }
    doc.eventId = new mongoose.Types.ObjectId(patch.eventId);
  }

  const mergedType = patch.discountType ?? doc.discountType;
  const mergedValue = patch.discountValue !== undefined ? patch.discountValue : doc.discountValue;
  if (patch.discountType !== undefined || patch.discountValue !== undefined) {
    assertDiscountConsistent(mergedType, mergedValue);
  }
  if (patch.discountType !== undefined) {
    doc.discountType = patch.discountType;
  }
  if (patch.discountValue !== undefined) {
    doc.discountValue = patch.discountValue;
  }

  if (patch.isActive !== undefined) {
    doc.isActive = patch.isActive;
  }

  if ('usageLimit' in patch) {
    if (patch.usageLimit === null) {
      doc.set('usageLimit', undefined);
    } else if (patch.usageLimit !== undefined) {
      doc.usageLimit = patch.usageLimit;
    }
  }

  if ('expirationDate' in patch) {
    if (patch.expirationDate === null) {
      doc.set('expirationDate', undefined);
    } else if (patch.expirationDate !== undefined) {
      doc.expirationDate = new Date(patch.expirationDate);
    }
  }

  await doc.save();
  return formatAdminPromo(doc);
}

export default {
  validate,
  incrementUsage,
  decrementUsage,
  listAdminPromoCodes,
  getAdminPromoCodeById,
  createAdminPromoCode,
  patchAdminPromoCode,
  formatAdminPromo,
};
