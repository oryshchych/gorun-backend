import { Request, Response } from 'express';
import { frontendConfig } from '../config/env';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  exchangeOAuthCode,
  handleGoogleCallback,
  startGoogleOAuth,
} from '../services/auth/auth.oauth.service';
import authService from '../services/auth/auth.service';
import type { RegisterInput } from '../services/auth/auth.types';

function queryString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body as RegisterInput;
  const result = await authService.register(body);

  res.status(201).json({
    success: true,
    data: result,
  });
};

/**
 * Login an existing user
 * POST /api/auth/login
 */
export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password, rememberMe } = req.body as {
    email: string;
    password: string;
    rememberMe?: boolean;
  };

  const result = await authService.login(
    rememberMe === undefined ? { email, password } : { email, password, rememberMe }
  );

  res.status(200).json({
    success: true,
    data: result,
  });
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refresh = async (req: AuthRequest, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  const result = await authService.refreshAccessToken(refreshToken);

  res.status(200).json({
    success: true,
    data: result,
  });
};

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  await authService.logout(refreshToken);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const user = await authService.getCurrentUser(userId);

  res.status(200).json({
    success: true,
    data: user,
  });
};

/**
 * Start Google OAuth (redirect to Google)
 * GET /api/auth/google
 */
export const googleStart = async (req: Request, res: Response): Promise<void> => {
  const q = req.query as {
    redirect_uri: string;
    locale?: string;
    remember_me?: 'true' | 'false' | '1' | '0';
  };
  const rememberMe = q.remember_me === 'true' || q.remember_me === '1';
  const startParams: Parameters<typeof startGoogleOAuth>[0] = {
    redirectUri: q.redirect_uri,
    rememberMe,
  };
  if (q.locale !== undefined && q.locale !== '') {
    startParams.locale = q.locale;
  }
  const url = await startGoogleOAuth(startParams);
  res.redirect(302, url);
};

/**
 * Google OAuth callback (registered in Google Cloud)
 * GET /api/auth/google/callback
 */
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  const err = queryString(req.query.error);
  if (err) {
    const base = frontendConfig.url.replace(/\/$/, '');
    res.redirect(302, `${base}?oauth_error=${encodeURIComponent(err)}`);
    return;
  }

  const code = queryString(req.query.code);
  const state = queryString(req.query.state);
  const { redirectUrl } = await handleGoogleCallback(code, state);
  res.redirect(302, redirectUrl);
};

/**
 * Exchange one-time OAuth code for JWT (same shape as login)
 * POST /api/auth/oauth/exchange
 */
export const oauthExchange = async (req: AuthRequest, res: Response): Promise<void> => {
  const { code } = req.body as { code: string };
  const result = await exchangeOAuthCode(code);
  res.status(200).json({
    success: true,
    data: result,
  });
};

const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email, we sent password reset instructions.';

/**
 * Request password reset email
 * POST /api/auth/forgot-password
 */
export const forgotPasswordHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, locale } = req.body as { email: string; locale?: string };
  await authService.forgotPassword(email, locale);
  res.status(200).json({
    success: true,
    message: FORGOT_PASSWORD_MESSAGE,
  });
};

/**
 * Set new password with token from email
 * POST /api/auth/reset-password
 */
export const resetPasswordHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { token, password, confirmPassword } = req.body as {
    token: string;
    password: string;
    confirmPassword: string;
  };
  await authService.resetPassword(token, password, confirmPassword);
  res.status(200).json({
    success: true,
    message: 'Password has been reset. You can sign in with your new password.',
  });
};
