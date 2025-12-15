import { z } from 'zod';

// Helper to validate MongoDB ObjectId format
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const flexibleIdSchema = z
  .string()
  .refine(value => objectIdRegex.test(value) || uuidRegex.test(value), 'Invalid event ID format');
const phoneRegex = /^\+?[\d\s-()]+$/;

export const createRegistrationSchema = z.object({
  eventId: z.string().regex(objectIdRegex, 'Invalid event ID format'),
});

export const createPublicRegistrationSchema = z.object({
  eventId: flexibleIdSchema,
  name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters' })
    .max(50, { message: 'Name must not exceed 50 characters' }),
  surname: z
    .string()
    .min(2, { message: 'Surname must be at least 2 characters' })
    .max(50, { message: 'Surname must not exceed 50 characters' }),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address (e.g., user@example.com)' })
    .transform(val => val.toLowerCase()),
  city: z
    .string()
    .min(2, { message: 'City must be at least 2 characters' })
    .max(100, { message: 'City must not exceed 100 characters' }),
  runningClub: z
    .string()
    .max(100, { message: 'Running club must not exceed 100 characters' })
    .optional(),
  phone: z
    .string()
    .max(20, { message: 'Phone must not exceed 20 characters' })
    .regex(phoneRegex, {
      message: 'Phone must contain only numbers, spaces, +, -, or parentheses',
    })
    .optional(),
  promoCode: z.string().max(50, { message: 'Promo code must not exceed 50 characters' }).optional(),
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
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
});

export const eventIdParamSchema = z.object({
  eventId: z.string().regex(objectIdRegex, 'Invalid event ID format'),
});

export const publicEventIdParamSchema = z.object({
  eventId: flexibleIdSchema,
});
