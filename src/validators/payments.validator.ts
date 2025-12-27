import { z } from 'zod';

export const paymentIdSchema = z.object({
  id: z.string().min(1, 'Payment ID is required'),
});

export const refundSchema = z.object({
  amount: z.number().positive().optional(),
  extRef: z.string().optional(),
});
