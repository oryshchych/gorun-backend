import { z } from 'zod';

// Helper to validate MongoDB ObjectId format
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const localeString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Must not exceed ${max} characters` })
    .refine(val => val.length === 0 || val.length >= min, {
      message: `Must be at least ${min} characters or empty`,
    });

const translationFieldSchema = z.object({
  en: z.string().trim().optional(),
  uk: z.string().trim().optional(),
});

const speakerTranslationsSchema = z.object({
  fullname: translationFieldSchema.optional(),
  shortDescription: translationFieldSchema.optional(),
  description: translationFieldSchema.optional(),
});

const speakerSchema = z.object({
  id: z.string().optional(),
  translations: speakerTranslationsSchema.optional(),
  fullname: z
    .string()
    .trim()
    .min(1, { message: 'Fullname must be at least 1 character' })
    .max(200, { message: 'Fullname must not exceed 200 characters' }),
  shortDescription: z
    .string()
    .trim()
    .min(1, { message: 'Short description must be at least 1 character' })
    .max(500, { message: 'Short description must not exceed 500 characters' }),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Description must be at least 1 character' })
    .max(2000, { message: 'Description must not exceed 2000 characters' }),
  image: z
    .string()
    .trim()
    .url({ message: 'Image must be a valid URL' })
    .min(1, { message: 'Image URL is required' }),
  instagramLink: z
    .string()
    .trim()
    .url({ message: 'Instagram link must be a valid URL' })
    .min(1, { message: 'Instagram link is required' }),
});

const translationsSchema = z.object({
  title: z.object({
    en: z
      .string()
      .trim()
      .min(3, { message: 'Title (en) must be at least 3 characters' })
      .max(100, { message: 'Title (en) must not exceed 100 characters' }),
    uk: localeString(3, 100),
  }),
  description: z.object({
    en: z
      .string()
      .trim()
      .min(10, { message: 'Description (en) must be at least 10 characters' })
      .max(2000, { message: 'Description (en) must not exceed 2000 characters' }),
    uk: localeString(10, 2000),
  }),
  location: z.object({
    en: z
      .string()
      .trim()
      .min(3, { message: 'Location (en) must be at least 3 characters' })
      .max(200, { message: 'Location (en) must not exceed 200 characters' }),
    uk: localeString(3, 200),
  }),
  speakers: z
    .array(
      z.object({
        en: z
          .string()
          .trim()
          .min(1, { message: 'Speaker (en) must have at least 1 character' })
          .max(100),
        uk: localeString(1, 100),
      })
    )
    .optional(),
  date: z
    .object({
      en: z.string().trim().optional(),
      uk: z.string().trim().optional(),
    })
    .optional(),
});

export const createEventSchema = z.object({
  translations: translationsSchema,
  // Legacy fallbacks still accepted; they will be derived from translations if not provided
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  speakers: z.array(speakerSchema).optional(),
  date: z
    .string()
    .or(z.date())
    .transform(val => new Date(val))
    .refine(date => date > new Date(), {
      message: 'Event date must be in the future',
    }),
  capacity: z
    .number()
    .int({ message: 'Capacity must be an integer' })
    .min(1, { message: 'Capacity must be at least 1' })
    .max(10000, { message: 'Capacity must not exceed 10000' }),
  imageUrl: z
    .object({
      portrait: z.string().url({ message: 'Portrait image URL must be a valid URL' }),
      landscape: z.string().url({ message: 'Landscape image URL must be a valid URL' }),
    })
    .optional(),
  basePrice: z.number().nonnegative({ message: 'Base price cannot be negative' }).optional(),
  gallery: z.array(z.string().url({ message: 'Gallery items must be valid URLs' })).optional(),
  map: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
});

export const updateEventSchema = z.object({
  translations: translationsSchema
    .partial()
    .refine(val => val === undefined || Object.keys(val).length > 0, {
      message: 'Translations cannot be empty',
    })
    .optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  date: z
    .string()
    .or(z.date())
    .transform(val => new Date(val))
    .refine(date => date > new Date(), {
      message: 'Event date must be in the future',
    })
    .optional(),
  location: z.string().optional(),
  capacity: z
    .number()
    .int({ message: 'Capacity must be an integer' })
    .min(1, { message: 'Capacity must be at least 1' })
    .max(10000, { message: 'Capacity must not exceed 10000' })
    .optional(),
  imageUrl: z
    .object({
      portrait: z.string().url({ message: 'Portrait image URL must be a valid URL' }),
      landscape: z.string().url({ message: 'Landscape image URL must be a valid URL' }),
    })
    .optional(),
  basePrice: z.number().nonnegative({ message: 'Base price cannot be negative' }).optional(),
  speakers: z.array(speakerSchema).optional(),
  gallery: z.array(z.string().url({ message: 'Gallery items must be valid URLs' })).optional(),
  map: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
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
  lang: z.enum(['en', 'uk']).optional(),
});
