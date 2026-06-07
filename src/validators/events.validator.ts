import { z } from 'zod';
import { EVENT_LIFECYCLE_PHASE_VALUES, EVENT_STATUS_VALUES } from '../models/Event';

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
  image: z.string().trim().min(1, { message: 'Image URL is required' }),
  instagramLink: z.string().trim().min(1, { message: 'Instagram link is required' }),
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
  partners: z
    .array(
      z.object({
        en: z.string().trim().optional(),
        uk: z.string().trim().optional(),
        imageUrl: z.string().url({ message: 'Partner image URL must be a valid URL' }).optional(),
      })
    )
    .optional(),
  pastDescription: z
    .object({
      en: z.string().trim().optional(),
      uk: z.string().trim().optional(),
    })
    .optional(),
});

const distanceSpotsSchema = z.object({
  taken: z.number().int().min(0).optional(),
  total: z.number().int().min(0).optional(),
});

/** Accepts a URL string or empty string; empty string is treated as undefined. */
const optionalUrl = (message: string) =>
  z.preprocess(val => (val === '' ? undefined : val), z.string().url({ message }).optional());

/** Accepts a number, null, or empty string; empty string/null → null. */
const optionalNumericOrEmpty = z.preprocess(
  val => (val === '' || val === null ? null : val),
  z.number().nullable().optional()
);

const pricePeriodSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  price: z.number().positive({ message: 'Price must be greater than 0' }),
});

const distanceSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().trim().optional(),
    name: z.string().trim().max(100).optional(),
    km: z.preprocess(val => (val === '' ? undefined : val), z.number().optional()),
    feeUah: z.preprocess(val => (val === '' ? undefined : val), z.number().optional()),
    elevation: z.string().trim().optional(),
    laps: optionalNumericOrEmpty,
    spots: distanceSpotsSchema.optional(),
    distanceMeters: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(1).max(999999).optional()
    ),
    startAt: z.coerce
      .date()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    participantLimit: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(1).optional()
    ),
    bibFrom: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(0).optional()
    ),
    bibTo: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(0).optional()
    ),
    isKids: z.boolean().optional(),
    discountPensioner: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(0).max(100).optional()
    ),
    discountVeteran: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(0).max(100).optional()
    ),
    discountDisability: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(0).max(100).optional()
    ),
    minAge: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(0).optional()
    ),
    maxAge: z.preprocess(
      val => (val === '' || val === null ? undefined : val),
      z.number().int().min(0).optional()
    ),
    pricePeriods: z.array(pricePeriodSchema).optional(),
  })
  .refine(d => d.bibTo === undefined || d.bibFrom === undefined || d.bibTo >= d.bibFrom, {
    path: ['bibTo'],
    message: 'Bib range end must be ≥ start',
  })
  .refine(d => d.maxAge === undefined || d.minAge === undefined || d.maxAge > d.minAge, {
    path: ['maxAge'],
    message: 'Max age must be greater than min age',
  });

const kidsDistanceSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().optional(),
  name: z.string().trim().optional(),
  age: z.string().trim().optional(),
  feeUah: z.number().optional(),
});

const scheduleItemSchema = z.object({
  time: z.string().trim().min(1),
  what: z.string().trim().min(1),
});

const spotsSchema = z.object({
  taken: z.number().int().min(0).optional(),
  total: z.number().int().min(0).optional(),
});

const dateField = z
  .string()
  .or(z.date())
  .transform(val => new Date(val));

export const createEventSchema = z.object({
  translations: translationsSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  speakers: z.array(speakerSchema).optional(),
  date: dateField,
  capacity: z
    .number()
    .int({ message: 'Capacity must be an integer' })
    .min(1, { message: 'Capacity must be at least 1' })
    .max(10000, { message: 'Capacity must not exceed 10000' }),
  isActive: z.boolean().optional(),
  lifecyclePhase: z.enum(EVENT_LIFECYCLE_PHASE_VALUES).optional(),
  status: z.enum(EVENT_STATUS_VALUES).optional(),
  slug: z.string().trim().optional(),
  shortDesc: z.string().trim().optional(),
  city: z.string().trim().optional(),
  venue: z.string().trim().optional(),
  dateLabel: z.string().trim().optional(),
  timeLabel: z.string().trim().optional(),
  cover: z.string().trim().optional(),
  fee: z.string().trim().optional(),
  afu: z.string().trim().optional(),
  perks: z.array(z.string()).optional(),
  spots: spotsSchema.optional(),
  imageUrl: z
    .object({
      portrait: optionalUrl('Portrait image URL must be a valid URL'),
      landscape: optionalUrl('Landscape image URL must be a valid URL'),
    })
    .optional(),
  basePrice: z.number().nonnegative({ message: 'Base price cannot be negative' }).optional(),
  gallery: z.array(z.string().url({ message: 'Gallery items must be valid URLs' })).optional(),
  distances: z.array(distanceSchema).optional(),
  kidsDistances: z.array(kidsDistanceSchema).optional(),
  schedule: z.array(scheduleItemSchema).optional(),
  program: z.array(scheduleItemSchema).optional(),
  map: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
  registrationStart: z.coerce.date().optional(),
  registrationEnd: z.coerce.date().optional(),
  socials: z
    .object({
      instagram: z.string().trim().optional().or(z.literal('')),
      facebook: z.string().trim().optional().or(z.literal('')),
      telegram: z.string().trim().optional().or(z.literal('')),
    })
    .optional(),
  regulationUrl: optionalUrl('Regulation URL must be a valid URL'),
  scheduleText: z.string().max(5000).optional(),
  organizerInfo: z.string().trim().max(300).optional(),
  organizerContactName: z.string().trim().max(200).optional(),
  organizerContactInfo: z.string().trim().max(500).optional(),
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
  date: dateField.optional(),
  location: z.string().optional(),
  capacity: z
    .number()
    .int({ message: 'Capacity must be an integer' })
    .min(1, { message: 'Capacity must be at least 1' })
    .max(10000, { message: 'Capacity must not exceed 10000' })
    .optional(),
  isActive: z.boolean().optional(),
  lifecyclePhase: z.enum(EVENT_LIFECYCLE_PHASE_VALUES).optional(),
  status: z.enum(EVENT_STATUS_VALUES).optional(),
  slug: z.string().trim().optional(),
  shortDesc: z.string().trim().optional(),
  city: z.string().trim().optional(),
  venue: z.string().trim().optional(),
  dateLabel: z.string().trim().optional(),
  timeLabel: z.string().trim().optional(),
  cover: z.string().trim().optional(),
  fee: z.string().trim().optional(),
  afu: z.string().trim().optional(),
  perks: z.array(z.string()).optional(),
  spots: spotsSchema.optional(),
  imageUrl: z
    .object({
      portrait: optionalUrl('Portrait image URL must be a valid URL'),
      landscape: optionalUrl('Landscape image URL must be a valid URL'),
    })
    .optional(),
  basePrice: z.number().nonnegative({ message: 'Base price cannot be negative' }).optional(),
  speakers: z.array(speakerSchema).optional(),
  gallery: z.array(z.string().url({ message: 'Gallery items must be valid URLs' })).optional(),
  distances: z.array(distanceSchema).optional(),
  kidsDistances: z.array(kidsDistanceSchema).optional(),
  schedule: z.array(scheduleItemSchema).optional(),
  program: z.array(scheduleItemSchema).optional(),
  map: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
  registrationStart: z.coerce.date().optional(),
  registrationEnd: z.coerce.date().optional(),
  socials: z
    .object({
      instagram: z.string().trim().optional().or(z.literal('')),
      facebook: z.string().trim().optional().or(z.literal('')),
      telegram: z.string().trim().optional().or(z.literal('')),
    })
    .optional(),
  regulationUrl: optionalUrl('Regulation URL must be a valid URL'),
  scheduleText: z.string().max(5000).optional(),
  organizerInfo: z.string().trim().max(300).optional(),
  organizerContactName: z.string().trim().max(200).optional(),
  organizerContactInfo: z.string().trim().max(500).optional(),
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
  status: z.enum(EVENT_STATUS_VALUES).optional(),
  lifecyclePhase: z.enum(EVENT_LIFECYCLE_PHASE_VALUES).optional(),
  isActive: z
    .string()
    .optional()
    .transform(val => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});
