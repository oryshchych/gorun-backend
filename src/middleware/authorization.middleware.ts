import { NextFunction, Response } from 'express';
import { Event } from '../models/Event';
import { ForbiddenError, NotFoundError } from '../types/errors';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware to verify user is the event organizer
 * Loads event and checks if organizerId matches authenticated userId
 * Returns 403 if not authorized
 */
export const isEventOrganizer = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const eventId = (req.validatedParams as { id?: string } | undefined)?.id ?? req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ForbiddenError('User not authenticated');
    }

    // Load event
    const event = await Event.findById(eventId);

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Check if user is the organizer
    if (event.organizerId.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to modify this event');
    }

    next();
  } catch (error) {
    next(error);
  }
};
