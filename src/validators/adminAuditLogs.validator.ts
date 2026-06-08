import { z } from 'zod';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../models/AuditLog';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listAuditLogsSchema = z.object({
  entity: z.enum(AUDIT_ENTITIES).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  actorId: z.string().regex(objectIdRegex, 'Invalid actor ID').optional(),
  actorEmail: z.string().email('Invalid email').optional(),
  dateFrom: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
    ),
  dateTo: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
    ),
  page: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 1))
    .refine(val => val > 0, 'Page must be positive'),
  limit: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : 20))
    .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100'),
});
