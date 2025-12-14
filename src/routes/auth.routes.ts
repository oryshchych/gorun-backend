import { Router } from 'express';
import { register, login, refresh, logout, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', validate(registerSchema, ValidationType.BODY), asyncHandler(register));

/**
 * POST /api/auth/login
 * Login an existing user
 */
router.post('/login', validate(loginSchema, ValidationType.BODY), asyncHandler(login));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', validate(refreshTokenSchema, ValidationType.BODY), asyncHandler(refresh));

/**
 * POST /api/auth/logout
 * Logout user (requires authentication)
 */
router.post(
  '/logout',
  authenticate,
  validate(refreshTokenSchema, ValidationType.BODY),
  asyncHandler(logout)
);

/**
 * GET /api/auth/me
 * Get current user profile (requires authentication)
 */
router.get('/me', authenticate, asyncHandler(me));

export default router;
