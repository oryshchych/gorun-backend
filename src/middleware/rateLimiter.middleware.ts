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
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
});
