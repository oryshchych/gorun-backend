import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import registrationsService from '../services/registrations.service';
import { REGISTRATIONS_CODES } from '../types/codes';

/**
 * Get all registrations with filters and pagination
 * GET /api/registrations
 */
export const getRegistrations = async (req: AuthRequest, res: Response): Promise<void> => {
  const { eventId, status, page, limit } = req.query;

  // Build filters object, only including defined values
  const filters: {
    eventId?: string;
    status?: 'confirmed' | 'cancelled';
  } = {};
  if (eventId) filters.eventId = eventId as string;
  if (status) filters.status = status as 'confirmed' | 'cancelled';

  const result = await registrationsService.getRegistrations(
    filters,
    page ? Number(page) : undefined,
    limit ? Number(limit) : undefined
  );

  res.status(200).json({
    success: true,
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATIONS_LIST_RETRIEVED,
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
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATIONS_LIST_RETRIEVED,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get registrations for a specific event
 * GET /api/events/:eventId/registrations
 */
export const getEventRegistrations = async (req: AuthRequest, res: Response): Promise<void> => {
  const { eventId } = req.params;
  const userId = req.user!.userId;
  const { page, limit } = req.query;

  if (!eventId) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  const result = await registrationsService.getEventRegistrations(
    eventId,
    userId,
    page ? Number(page) : undefined,
    limit ? Number(limit) : undefined
  );

  res.status(200).json({
    success: true,
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATIONS_LIST_RETRIEVED,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Create a new registration (public)
 * POST /api/registrations
 */
export const createPublicRegistration = async (req: Request, res: Response): Promise<void> => {
  const registration = await registrationsService.createPublicRegistration(req.body);

  res.status(201).json({
    success: true,
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATION_CREATED,
    data: registration.registration,
    paymentLink: registration.paymentLink,
  });
};

/**
 * Create a new registration
 * POST /api/registrations
 */
export const createRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { eventId } = req.body;

  const registration = await registrationsService.createRegistration(userId, {
    eventId,
  });

  res.status(201).json({
    success: true,
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATION_CREATED,
    data: registration,
  });
};

/**
 * Cancel a registration
 * DELETE /api/registrations/:id
 */
export const cancelRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;

  if (!id) {
    res.status(400).json({
      success: false,
      code: REGISTRATIONS_CODES.ERROR_REGISTRATION_INVALID_ID,
      message: 'Registration ID is required',
    });
    return;
  }

  await registrationsService.cancelRegistration(id, userId);

  res.status(200).json({
    success: true,
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATION_CANCELLED,
  });
};

/**
 * Get public list of participants for an event
 * GET /api/events/:eventId/participants
 */
export const getPublicParticipants = async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.params;

  if (!eventId) {
    res.status(400).json({
      success: false,
      code: REGISTRATIONS_CODES.ERROR_REGISTRATION_INVALID_ID,
      message: 'Event ID is required',
    });
    return;
  }

  const participants = await registrationsService.getPublicParticipants(eventId);

  res.status(200).json({
    success: true,
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATION_PARTICIPANTS_RETRIEVED,
    data: participants,
  });
};

/**
 * Process refund for a registration
 * POST /api/registrations/:id/refund
 */
export const processRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { amount, extRef } = req.body;

  if (!id) {
    res.status(400).json({
      success: false,
      code: REGISTRATIONS_CODES.ERROR_REGISTRATION_INVALID_ID,
      message: 'Registration ID is required',
    });
    return;
  }

  const registration = await registrationsService.processRefund(id, amount, extRef);

  res.status(200).json({
    success: true,
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATION_REFUNDED,
    data: registration,
  });
};

/**
 * Get payment link for existing registration by email
 * GET /api/registrations/payment-link?email=...&eventId=...
 * Used when user closes payment page and needs to resume payment
 */
export const getPaymentLink = async (req: Request, res: Response): Promise<void> => {
  const { email, eventId } = req.query;

  if (!email || !eventId) {
    res.status(400).json({
      success: false,
      code: REGISTRATIONS_CODES.ERROR_REGISTRATION_INVALID_ID,
      message: 'Email and eventId are required',
    });
    return;
  }

  const result = await registrationsService.getPaymentLinkByEmail(
    email as string,
    eventId as string
  );

  if (!result) {
    res.status(404).json({
      success: false,
      code: REGISTRATIONS_CODES.ERROR_REGISTRATION_PAYMENT_LINK_NOT_FOUND,
      message: 'No pending registration found for this email and event',
    });
    return;
  }

  res.status(200).json({
    success: true,
    code: REGISTRATIONS_CODES.SUCCESS_REGISTRATION_PAYMENT_LINK_RETRIEVED,
    data: result.registration,
    paymentLink: result.paymentLink,
  });
};

/**
 * Sync payment status from Monobank API
 * POST /api/registrations/:id/sync-payment
 * Fallback mechanism to check payment status if webhook was missed
 */
export const syncPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({
      success: false,
      code: REGISTRATIONS_CODES.ERROR_REGISTRATION_INVALID_ID,
      message: 'Registration ID is required',
    });
    return;
  }

  try {
    const result = await registrationsService.syncPaymentStatus(id);

    res.status(200).json({
      success: true,
      code: REGISTRATIONS_CODES.SUCCESS_REGISTRATION_PAYMENT_SYNCED,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: REGISTRATIONS_CODES.ERROR_REGISTRATION_NO_PAYMENT,
      message: error instanceof Error ? error.message : 'Failed to sync payment status',
    });
  }
};
