import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PromoCode } from '../models/PromoCode';
import promoCodesService from '../services/promoCodes/promoCodes.service';
import type {
  CreateAdminPromoInput,
  AdminPromoListQuery,
  PatchAdminPromoInput,
} from '../services/promoCodes/promoCodes.service';
import { PROMO_CODES_CODES } from '../types/codes';
import { writeAuditLog } from '../utils/audit.util';

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

  void writeAuditLog({
    req,
    action: 'CREATE',
    entity: 'PromoCode',
    entityId: (data as { id?: string }).id ?? '',
    entityLabel: (data as { code?: string }).code ?? 'PromoCode',
    after: data as unknown as Record<string, unknown>,
  });

  res.status(201).json({
    success: true,
    code: PROMO_CODES_CODES.SUCCESS_PROMO_CODE_ADMIN_CREATED,
    data,
  });
};

export const patchAdminPromoCode = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const body = req.body as PatchAdminPromoInput;

  const before = await PromoCode.findById(id).lean();
  const data = await promoCodesService.patchAdminPromoCode(id, body);
  const after = await PromoCode.findById(id).lean();

  void writeAuditLog({
    req,
    action: 'UPDATE',
    entity: 'PromoCode',
    entityId: id,
    entityLabel: (before as { code?: string } | null)?.code ?? id,
    before: (before ?? {}) as Record<string, unknown>,
    after: (after ?? {}) as Record<string, unknown>,
  });

  res.status(200).json({
    success: true,
    code: PROMO_CODES_CODES.SUCCESS_PROMO_CODE_ADMIN_UPDATED,
    data,
  });
};
