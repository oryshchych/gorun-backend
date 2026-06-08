import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const ANALYTICS_PRESETS = ['week', 'month', '3months', 'year', 'custom'] as const;
export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number];

/**
 * Shared query schema for every analytics endpoint.
 * Query params arrive as strings; `from`/`to` are coerced to `Date` (undefined when absent).
 * `custom` requires both `from` and `to`; otherwise they are optional overrides.
 */
export const analyticsQuerySchema = z
  .object({
    preset: z.enum(ANALYTICS_PRESETS).optional().default('month'),
    from: z
      .string()
      .optional()
      .transform(v => (v ? new Date(v) : undefined))
      .refine(v => v === undefined || !Number.isNaN(v.getTime()), {
        message: 'from must be a valid date',
      }),
    to: z
      .string()
      .optional()
      .transform(v => (v ? new Date(v) : undefined))
      .refine(v => v === undefined || !Number.isNaN(v.getTime()), {
        message: 'to must be a valid date',
      }),
    eventId: z.string().regex(objectIdRegex, { message: 'Invalid event ID format' }).optional(),
  })
  .refine(q => q.preset !== 'custom' || (q.from !== undefined && q.to !== undefined), {
    path: ['from'],
    message: 'from and to are required when preset is "custom"',
  })
  .refine(q => q.from === undefined || q.to === undefined || q.from <= q.to, {
    path: ['to'],
    message: 'from must be earlier than or equal to to',
  });
