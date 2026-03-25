import { Router } from 'express';
import {
  forgotPasswordHandler,
  googleCallback,
  googleStart,
  login,
  logout,
  me,
  oauthExchange,
  patchMe,
  refresh,
  register,
  resetPasswordHandler,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { ValidationType, validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  forgotPasswordSchema,
  googleOAuthStartQuerySchema,
  loginSchema,
  oauthExchangeSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/register', validate(registerSchema, ValidationType.BODY), asyncHandler(register));

router.post('/login', validate(loginSchema, ValidationType.BODY), asyncHandler(login));

router.post('/refresh', validate(refreshTokenSchema, ValidationType.BODY), asyncHandler(refresh));

router.post(
  '/logout',
  authenticate,
  validate(refreshTokenSchema, ValidationType.BODY),
  asyncHandler(logout)
);

router.get('/me', authenticate, asyncHandler(me));

router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema, ValidationType.BODY),
  asyncHandler(patchMe)
);

router.get(
  '/google',
  validate(googleOAuthStartQuerySchema, ValidationType.QUERY),
  asyncHandler(googleStart)
);

router.get('/google/callback', asyncHandler(googleCallback));

router.post(
  '/oauth/exchange',
  validate(oauthExchangeSchema, ValidationType.BODY),
  asyncHandler(oauthExchange)
);

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema, ValidationType.BODY),
  asyncHandler(forgotPasswordHandler)
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema, ValidationType.BODY),
  asyncHandler(resetPasswordHandler)
);

export default router;
