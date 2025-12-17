import rateLimit from 'express-rate-limit';

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
});
