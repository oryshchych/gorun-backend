import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { rateLimitConfig } from '../config/env';

// Phase 4: replace with a Redis-backed store when REDIS_URL is provisioned.
// Until then, express-rate-limit defaults to in-memory (fine for single-instance).
// const store = createRedisStore(process.env.REDIS_URL);

/**
 * Custom key generator that uses express-rate-limit's ipKeyGenerator helper.
 * Properly handles IPv6 and prevents header-spoofing when trust proxy is set.
 */
const keyGenerator = (req: Request): string => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return ipKeyGenerator(ip);
};

/**
 * Rate limiter for authentication endpoints.
 * 10 attempts per 15 minutes per IP; successful requests are not counted so
 * legitimate users are not penalised for normal activity.
 */
export const authLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.authMaxRequests,
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator,
});

/**
 * Rate limiter for general API endpoints.
 * 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.maxRequests,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

/**
 * Rate limiter for public registration endpoint
 * 5 requests per minute per IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many registration attempts, please try again in a minute',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator, // Use custom key generator to prevent IP spoofing
});

/**
 * Rate limiter for webhook endpoints
 * 30 requests per minute per IP — generous for legitimate payment processors,
 * blocks automated forged-webhook abuse.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many webhook requests from this IP, please try again in a minute',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
});

/**
 * Rate limiter for promo code validation
 * 10 requests per minute per IP
 */
export const promoCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many promo code requests, please try again in a minute',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator, // Use custom key generator to prevent IP spoofing
});
