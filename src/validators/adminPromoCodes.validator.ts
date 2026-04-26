import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const discountTypeInput = z.enum(['percentage', 'fixed']);

function refineDiscountValue(
  discountType: 'percentage' | 'amount',
  discountValue: number,
  ctx: z.RefinementCtx
): void {
  if (discountType === 'percentage' && discountValue > 100) {
    ctx.addIssue({
      code: 'custom',
      message: 'Percentage discount cannot exceed 100',
      path: ['discountValue'],
    });
  }
  if (discountType === 'amount' && discountValue <= 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Fixed discount must be greater than 0',
      path: ['discountValue'],
    });
  }
}

export const adminPromoIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid promo ID format' }),
});

export const adminPromoListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform(v => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().min(1)),
  limit: z
    .string()
    .optional()
    .transform(v => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().min(1).max(100)),
  eventId: z.string().regex(objectIdRegex).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().max(100).trim().optional(),
});

export const adminPromoCreateBodySchema = z
  .object({
    code: z
      .string()
      .min(1, { message: 'Code is required' })
      .max(50)
      .transform(s => s.toUpperCase().trim()),
    discountType: discountTypeInput.transform(t => (t === 'fixed' ? 'amount' : t)),
    discountValue: z.number().nonnegative(),
    eventId: z.string().regex(objectIdRegex, { message: 'Invalid event ID' }),
    isActive: z.boolean().optional().default(true),
    usageLimit: z.union([z.null(), z.number().int().positive()]).optional(),
    expirationDate: z.union([z.null(), z.string()]).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    refineDiscountValue(data.discountType, data.discountValue, ctx);
    if (data.expirationDate != null && data.expirationDate !== '') {
      const d = new Date(data.expirationDate);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid expiration date',
          path: ['expirationDate'],
        });
      }
    }
  });

export const adminPromoPatchBodySchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(50)
      .transform(s => s.toUpperCase().trim())
      .optional(),
    discountType: discountTypeInput.transform(t => (t === 'fixed' ? 'amount' : t)).optional(),
    discountValue: z.number().nonnegative().optional(),
    eventId: z.string().regex(objectIdRegex).optional(),
    isActive: z.boolean().optional(),
    usageLimit: z.union([z.null(), z.number().int().positive()]).optional(),
    expirationDate: z.union([z.null(), z.string()]).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.discountType !== undefined && data.discountValue !== undefined) {
      refineDiscountValue(data.discountType, data.discountValue, ctx);
    }
    if (
      data.expirationDate != null &&
      data.expirationDate !== '' &&
      data.expirationDate !== undefined
    ) {
      const d = new Date(data.expirationDate);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid expiration date',
          path: ['expirationDate'],
        });
      }
    }
  });
