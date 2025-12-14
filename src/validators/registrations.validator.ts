import { z } from 'zod';

// Helper to validate MongoDB ObjectId format
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createRegistrationSchema = z.object({
  eventId: z.string().regex(objectIdRegex, 'Invalid event ID format'),
});

export const registrationIdSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid registration ID format'),
});

export const getRegistrationsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 1))
    .refine(val => val > 0, { message: 'Page must be greater than 0' }),
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 10))
    .refine(val => val > 0 && val <= 100, {
      message: 'Limit must be between 1 and 100',
    }),
  eventId: z.string().regex(objectIdRegex, 'Invalid event ID format').optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
});

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(objectIdRegex, 'Invalid event ID format'),
});
