import { z } from 'zod';

// Helper to validate MongoDB ObjectId format
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createEventSchema = z.object({
  title: z
    .string()
    .min(3, { message: 'Title must be at least 3 characters' })
    .max(100, { message: 'Title must not exceed 100 characters' }),
  description: z
    .string()
    .min(10, { message: 'Description must be at least 10 characters' })
    .max(2000, { message: 'Description must not exceed 2000 characters' }),
  date: z
    .string()
    .or(z.date())
    .transform(val => new Date(val))
    .refine(date => date > new Date(), {
      message: 'Event date must be in the future',
    }),
  location: z
    .string()
    .min(3, { message: 'Location must be at least 3 characters' })
    .max(200, { message: 'Location must not exceed 200 characters' }),
  capacity: z
    .number()
    .int({ message: 'Capacity must be an integer' })
    .min(1, { message: 'Capacity must be at least 1' })
    .max(10000, { message: 'Capacity must not exceed 10000' }),
  imageUrl: z.url({ message: 'Invalid URL format' }).optional(),
  basePrice: z.number().nonnegative({ message: 'Base price cannot be negative' }).optional(),
  speakers: z.array(z.string().min(1)).optional(),
  gallery: z.array(z.string().url({ message: 'Gallery items must be valid URLs' })).optional(),
});

export const updateEventSchema = z.object({
  title: z
    .string()
    .min(3, { message: 'Title must be at least 3 characters' })
    .max(100, { message: 'Title must not exceed 100 characters' })
    .optional(),
  description: z
    .string()
    .min(10, { message: 'Description must be at least 10 characters' })
    .max(2000, { message: 'Description must not exceed 2000 characters' })
    .optional(),
  date: z
    .string()
    .or(z.date())
    .transform(val => new Date(val))
    .refine(date => date > new Date(), {
      message: 'Event date must be in the future',
    })
    .optional(),
  location: z
    .string()
    .min(3, { message: 'Location must be at least 3 characters' })
    .max(200, { message: 'Location must not exceed 200 characters' })
    .optional(),
  capacity: z
    .number()
    .int({ message: 'Capacity must be an integer' })
    .min(1, { message: 'Capacity must be at least 1' })
    .max(10000, { message: 'Capacity must not exceed 10000' })
    .optional(),
  imageUrl: z.url({ message: 'Invalid URL format' }).optional(),
  basePrice: z.number().nonnegative({ message: 'Base price cannot be negative' }).optional(),
  speakers: z.array(z.string().min(1)).optional(),
  gallery: z.array(z.string().url({ message: 'Gallery items must be valid URLs' })).optional(),
});

export const eventIdSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid event ID format' }),
});

export const getEventsQuerySchema = z.object({
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
  search: z.string().optional(),
  startDate: z
    .string()
    .optional()
    .transform(val => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform(val => (val ? new Date(val) : undefined)),
  location: z.string().optional(),
});
