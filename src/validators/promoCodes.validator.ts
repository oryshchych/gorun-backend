import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const flexibleEventId = z
  .string()
  .refine(value => objectIdRegex.test(value) || uuidRegex.test(value), 'Invalid event ID format');

export const validatePromoCodeSchema = z.object({
  code: z
    .string()
    .min(1, { message: 'Promo code is required' })
    .max(50, { message: 'Promo code must not exceed 50 characters' })
    .transform(value => value.toUpperCase().trim()),
  eventId: flexibleEventId.optional(),
});
