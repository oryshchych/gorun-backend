import { z } from 'zod';

/**
 * Monobank webhook payload schema
 * Documentation: https://monobank.ua/api-docs/acquiring/dev/webhooks/verify
 */
export const plataWebhookSchema = z.object({
  invoiceId: z.string(),
  status: z.enum(['created', 'processing', 'success', 'failure', 'expired', 'hold']).optional(),
  failureReason: z.string().optional(),
  amount: z.number().optional(),
  ccy: z.number().optional(),
  finalAmount: z.number().optional(),
  createdDate: z.string().optional(),
  modifiedDate: z.string().optional(),
  reference: z.string().optional(),
  paymentId: z.string().optional(),
  merchantData: z
    .object({
      registrationId: z.string().optional(),
      customerName: z.string().optional(),
      eventTitle: z.string().optional(),
    })
    .optional(),
  cancelList: z.array(z.unknown()).optional(),
});
