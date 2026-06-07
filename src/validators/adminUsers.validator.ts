import { z } from 'zod';
import { USER_GENDER_VALUES } from '../models/User';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const e164Regex = /^\+[1-9]\d{6,14}$/;

export const adminUserIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid user ID format' }),
});

export const adminUserRegistrationParamSchema = z.object({
  id: z.string().regex(objectIdRegex, { message: 'Invalid user ID format' }),
  registrationId: z.string().regex(objectIdRegex, { message: 'Invalid registration ID format' }),
});

export const adminUserListQuerySchema = z.object({
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
  source: z.enum(['all', 'registered', 'app_only']).optional(),
});

// Same filters as the list, minus pagination — drives the CSV export.
export const adminUserExportQuerySchema = z.object({
  search: z.string().max(100).trim().optional(),
  source: z.enum(['all', 'registered', 'app_only']).optional(),
});

// Profile / contact fields only. NO password, isAdmin, adminRole, or deletedAt.
export const adminUserUpdateBodySchema = z
  .object({
    firstName: z.string().max(100).trim().optional(),
    lastName: z.string().max(100).trim().optional(),
    phone: z
      .union([z.null(), z.string().regex(e164Regex, 'Phone must be in E.164 format')])
      .optional(),
    email: z.string().email('Invalid email address').toLowerCase().trim().optional(),
    dateOfBirth: z
      .union([z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD')])
      .optional(),
    gender: z.union([z.null(), z.enum(USER_GENDER_VALUES)]).optional(),
    emergencyContactName: z.union([z.null(), z.string().max(200).trim()]).optional(),
    emergencyContactPhone: z
      .union([z.null(), z.string().regex(e164Regex, 'Emergency phone must be in E.164 format')])
      .optional(),
    runningClub: z.union([z.null(), z.string().max(200).trim()]).optional(),
    city: z.union([z.null(), z.string().max(100).trim()]).optional(),
    deliveryAddress: z.union([z.null(), z.string().max(2000).trim()]).optional(),
  })
  .strict();
