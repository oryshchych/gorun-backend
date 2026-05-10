import { NextFunction, Response } from 'express';
import { Event } from '../models/Event';
import { User } from '../models/User';
import { ForbiddenError, NotFoundError } from '../types/errors';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware to verify user is the event organizer.
 * Loads event and checks if organizerId matches authenticated userId.
 * Returns 403 if not authorized.
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

    const event = await Event.findById(eventId);

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.organizerId.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to modify this event');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware that allows the event organizer OR any admin user to proceed.
 * Also sets req.user.isAdmin = true when the caller is an admin so that
 * downstream controllers/service can bypass organizer-only business rules.
 */
export const isEventOrganizerOrAdmin = async (
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

    const event = await Event.findById(eventId);

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.organizerId.toString() === userId) {
      next();
      return;
    }

    // Not the organizer — check if the user is an admin
    const user = await User.findById(userId).select('isAdmin adminRole');
    if (user?.isAdmin) {
      // Propagate admin context so service layer can skip organizer-only checks
      req.user = {
        userId,
        isAdmin: true,
        adminRole: user.adminRole ?? 'admin',
      };
      next();
      return;
    }

    throw new ForbiddenError('You are not authorized to modify this event');
  } catch (error) {
    next(error);
  }
};
