import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const adminRegistrationIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid registration ID format' }),
});

export const adminRegistrationListQuerySchema = z.object({
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
  search: z.string().max(100).trim().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  eventId: z.string().regex(objectIdRegex, { message: 'Invalid event ID format' }).optional(),
});

// Same filters as the list, minus pagination — drives the CSV export.
export const adminRegistrationExportQuerySchema = z.object({
  search: z.string().max(100).trim().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
  eventId: z.string().regex(objectIdRegex, { message: 'Invalid event ID format' }).optional(),
});
