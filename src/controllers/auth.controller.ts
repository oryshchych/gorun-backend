import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import authService from '../services/auth.service';

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, password } = req.body;

  const result = await authService.register({ name, email, password });

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
  const { email, password } = req.body;

  const result = await authService.login({ email, password });

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
  // userId is attached by authenticate middleware
  const userId = req.user!.userId;

  const user = await authService.getCurrentUser(userId);

  res.status(200).json({
    success: true,
    data: user,
  });
};
