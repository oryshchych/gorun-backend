import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number).pipe(z.number().positive()),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform(v => v.trim())
    .transform(v =>
      v
        .split(',')
        .map(o => new URL(o).origin)
        .join(',')
    ),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number).pipe(z.number().positive()),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number).pipe(z.number().positive()),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .default('5')
    .transform(Number)
    .pipe(z.number().positive()),
  BCRYPT_SALT_ROUNDS: z.string().default('10').transform(Number).pipe(z.number().positive()),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  // Public registration MVP
  PLATA_MONO_API_KEY: z.string().optional(),
  PLATA_MONO_WEBHOOK_SECRET: z.string().optional(),
  PLATA_MONO_WEBHOOK_URL: z.string().default('http://localhost:5000/api/webhooks/plata-mono'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  FRONTEND_SUCCESS_URL: z.string().default('http://localhost:3000/registration/success'),
  FRONTEND_FAILURE_URL: z.string().default('http://localhost:3000/registration/failed'),
  SINGLE_EVENT_ID: z.string().optional(),
  EVENT_BASE_PRICE: z.string().default('1000').transform(Number).pipe(z.number().nonnegative()),
});

// Validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
};

// Export validated and typed configuration
export const config = parseEnv();

// Export individual config sections for convenience
export const serverConfig = {
  nodeEnv: config.NODE_ENV,
  port: config.PORT,
};

export const databaseConfig = {
  mongoUri: config.MONGODB_URI,
};

export const jwtConfig = {
  accessSecret: config.JWT_ACCESS_SECRET,
  refreshSecret: config.JWT_REFRESH_SECRET,
  accessExpiry: config.JWT_ACCESS_EXPIRY,
  refreshExpiry: config.JWT_REFRESH_EXPIRY,
};

export const corsConfig = {
  origin: new Set(config.CORS_ORIGIN.split(',').map(o => o.trim())),
};

export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  authMaxRequests: config.AUTH_RATE_LIMIT_MAX_REQUESTS,
};

export const bcryptConfig = {
  saltRounds: config.BCRYPT_SALT_ROUNDS,
};

export const logConfig = {
  level: config.LOG_LEVEL,
};

export const paymentConfig = {
  plataApiKey: config.PLATA_MONO_API_KEY ?? '',
  plataWebhookSecret: config.PLATA_MONO_WEBHOOK_SECRET ?? '',
  currency: 'UAH',
  webhookUrl: config.PLATA_MONO_WEBHOOK_URL,
};

export const emailConfig = {
  resendApiKey: config.RESEND_API_KEY ?? '',
  fromEmail: config.RESEND_FROM_EMAIL ?? 'noreply@example.com',
};

export const frontendConfig = {
  url: config.FRONTEND_URL,
  successUrl: config.FRONTEND_SUCCESS_URL,
  failureUrl: config.FRONTEND_FAILURE_URL,
};

export const eventConfig = {
  singleEventId: config.SINGLE_EVENT_ID,
  basePrice: config.EVENT_BASE_PRICE,
};
