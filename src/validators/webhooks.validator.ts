import { z } from 'zod';

export const plataWebhookSchema = z.object({
  invoiceId: z.string(),
  status: z.enum(['success', 'failure', 'pending']).optional(),
  amount: z.number().optional(),
  merchantData: z
    .object({
      registrationId: z.string().optional(),
    })
    .optional(),
  paymentId: z.string().optional(),
});
