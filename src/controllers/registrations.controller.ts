import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import registrationsService from '../services/registrations.service';

/**
 * Get all registrations with filters and pagination
 * GET /api/registrations
 */
export const getRegistrations = async (req: AuthRequest, res: Response): Promise<void> => {
  const { eventId, status, page, limit } = req.query;

  const filters = {
    eventId: eventId as string | undefined,
    status: status as 'confirmed' | 'cancelled' | undefined,
  };

  const result = await registrationsService.getRegistrations(
    filters,
    page ? Number(page) : undefined,
    limit ? Number(limit) : undefined
  );

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get registrations for the authenticated user
 * GET /api/registrations/my
 */
export const getMyRegistrations = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { page, limit } = req.query;

  const result = await registrationsService.getMyRegistrations(
    userId,
    page ? Number(page) : undefined,
    limit ? Number(limit) : undefined
  );

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get registrations for a specific event
 * GET /api/events/:eventId/registrations
 */
export const getEventRegistrations = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { eventId } = req.params;
  const userId = req.user!.userId;
  const { page, limit } = req.query;

  const result = await registrationsService.getEventRegistrations(
    eventId,
    userId,
    page ? Number(page) : undefined,
    limit ? Number(limit) : undefined
  );

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Create a new registration
 * POST /api/registrations
 */
export const createRegistration = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const userId = req.user!.userId;
  const { eventId } = req.body;

  const registration = await registrationsService.createRegistration(userId, {
    eventId,
  });

  res.status(201).json({
    success: true,
    data: registration,
  });
};

/**
 * Cancel a registration
 * DELETE /api/registrations/:id
 */
export const cancelRegistration = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;

  await registrationsService.cancelRegistration(id, userId);

  res.status(204).send();
};
