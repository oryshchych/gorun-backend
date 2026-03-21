import { z } from 'zod';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const registerSchema = z
  .object({
    firstName: z.string().min(1).max(50).trim().optional(),
    lastName: z.string().min(1).max(50).trim().optional(),
    phone: z
      .string()
      .trim()
      .regex(E164_REGEX, { message: 'Phone must be in E.164 format (e.g. +380501234567)' })
      .optional(),
    /** @deprecated Use firstName, lastName, phone */
    name: z.string().min(2).max(50).trim().optional(),
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
