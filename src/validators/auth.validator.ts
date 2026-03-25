import { z } from 'zod';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const registerSchema = z
  .object({
    firstName: z.string().min(1).max(100).trim().optional(),
    lastName: z.string().min(1).max(100).trim().optional(),
    phone: z
      .string()
      .trim()
      .regex(E164_REGEX, { message: 'Phone must be in E.164 format (e.g. +380501234567)' })
      .optional(),
    /** @deprecated Use firstName, lastName, phone */
    name: z.string().min(2).max(100).trim().optional(),
    email: z.string().email({ message: 'Invalid email format' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .max(100, { message: 'Password must not exceed 100 characters' }),
  })
  .superRefine((data, ctx) => {
    const partialNew = Boolean(data.firstName || data.lastName || data.phone);
    const fullNew = Boolean(data.firstName && data.lastName && data.phone);
    const legacy = Boolean(data.name && data.name.length >= 2);

    if (partialNew && !fullNew) {
      if (!data.firstName) {
        ctx.addIssue({ code: 'custom', message: 'First name is required', path: ['firstName'] });
      }
      if (!data.lastName) {
        ctx.addIssue({ code: 'custom', message: 'Last name is required', path: ['lastName'] });
      }
      if (!data.phone) {
        ctx.addIssue({ code: 'custom', message: 'Phone is required', path: ['phone'] });
      }
      return;
    }

    if (!fullNew && !legacy) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide firstName, lastName, and phone, or name (legacy)',
        path: ['firstName'],
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }),
  password: z.string().min(1, { message: 'Password is required' }),
  rememberMe: z.boolean().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token is required' }),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }),
  locale: z.string().max(10).optional(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: 'Token is required' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters' })
      .max(100, { message: 'Password must not exceed 100 characters' }),
    confirmPassword: z.string().min(1, { message: 'Confirm password is required' }),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  });

export const oauthExchangeSchema = z.object({
  code: z.string().min(1, { message: 'Code is required' }),
});

/** Query for GET /auth/google — redirect_uri must be on FRONTEND_OAUTH_REDIRECT_ORIGINS whitelist */
export const googleOAuthStartQuerySchema = z.object({
  redirect_uri: z.string().url({ message: 'redirect_uri must be a valid URL' }),
  locale: z.string().max(10).optional(),
  remember_me: z.enum(['true', 'false', '1', '0']).optional(),
});

const PROFILE_GENDER = z.enum(['female', 'male', 'other', 'prefer_not_to_say']);

function ageFromIsoDateUtc(iso: string): number {
  const parts = iso.split('-').map(Number);
  const y = parts[0] as number;
  const mo = parts[1] as number;
  const d = parts[2] as number;
  const birth = new Date(Date.UTC(y, mo - 1, d));
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

function isValidCalendarDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(y, month - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

const nullableTrimmedString = (max: number, label: string) =>
  z.union([
    z.null(),
    z
      .string()
      .max(max, { message: `${label} must not exceed ${max} characters` })
      .trim()
      .min(1, { message: `${label} cannot be empty` }),
  ]);

/** Partial profile update; null clears a field. Omit keys you do not change. */
export const updateProfileSchema = z
  .object({
    firstName: nullableTrimmedString(100, 'First name').optional(),
    lastName: nullableTrimmedString(100, 'Last name').optional(),
    phone: z.union([z.null(), z.string().trim().regex(E164_REGEX)]).optional(),
    dateOfBirth: z.union([z.null(), z.string()]).optional(),
    gender: z.union([z.null(), PROFILE_GENDER]).optional(),
    emergencyContactName: nullableTrimmedString(200, 'Emergency contact name').optional(),
    emergencyContactPhone: z.union([z.null(), z.string().trim().regex(E164_REGEX)]).optional(),
    runningClub: nullableTrimmedString(200, 'Running club').optional(),
    city: nullableTrimmedString(100, 'City').optional(),
    deliveryAddress: nullableTrimmedString(2000, 'Delivery address').optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.dateOfBirth || data.dateOfBirth === null) return;
    const s = data.dateOfBirth;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      ctx.addIssue({
        code: 'custom',
        message: 'dateOfBirth must be YYYY-MM-DD',
        path: ['dateOfBirth'],
      });
      return;
    }
    if (!isValidCalendarDate(s)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid calendar date', path: ['dateOfBirth'] });
      return;
    }
    const dobUtc = new Date(`${s}T12:00:00.000Z`);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    if (dobUtc > todayEnd) {
      ctx.addIssue({
        code: 'custom',
        message: 'Date of birth cannot be in the future',
        path: ['dateOfBirth'],
      });
      return;
    }
    if (ageFromIsoDateUtc(s) < 18) {
      ctx.addIssue({
        code: 'custom',
        message: 'You must be at least 18 years old',
        path: ['dateOfBirth'],
      });
    }
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
