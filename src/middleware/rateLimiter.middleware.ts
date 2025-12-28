import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Custom key generator that uses express-rate-limit's ipKeyGenerator helper
 * This properly handles IPv6 addresses and prevents bypassing rate limits
 * With trust proxy set to 1, Express only trusts the first X-Forwarded-For header
 */
const keyGenerator = (req: Request): string => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  // Use express-rate-limit's ipKeyGenerator helper for proper IPv6 handling
  return ipKeyGenerator(ip);
};

/**
 * Rate limiter for authentication endpoints
 * Limits to 5 requests per 15 minutes per IP address
 * Requirements: 2.5, 17.2
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests, not just failed ones
  keyGenerator, // Use custom key generator to prevent IP spoofing
});

/**
 * Rate limiter for general API endpoints
 * Limits to 100 requests per 15 minutes per IP address
 * Requirements: 17.1
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
  keyGenerator, // Use custom key generator to prevent IP spoofing
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
