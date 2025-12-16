import { Router } from 'express';
import {
  checkRegistration,
  createEvent,
  deleteEvent,
  getEventById,
  getEvents,
  getMyEvents,
  getSingleEvent,
  updateEvent,
} from '../controllers/events.controller';
import {
  getEventRegistrations,
  getPublicParticipants,
} from '../controllers/registrations.controller';
import { authenticate } from '../middleware/auth.middleware';
import { isEventOrganizer } from '../middleware/authorization.middleware';
import { ValidationType, validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createEventSchema,
  eventIdSchema,
  getEventsQuerySchema,
  updateEventSchema,
} from '../validators/events.validator';
import {
  eventIdParamSchema,
  getRegistrationsQuerySchema,
  publicEventIdParamSchema,
} from '../validators/registrations.validator';

const router = Router();

/**
 * GET /api/events
 * Get all events with filters and pagination (public)
 */
router.get('/', validate(getEventsQuerySchema, ValidationType.QUERY), asyncHandler(getEvents));

/**
 * GET /api/events/single
 * Get the single public event
 */
router.get('/single', asyncHandler(getSingleEvent));

/**
 * GET /api/events/my
 * Get events created by the authenticated user
 * Note: This must come before /:id to avoid route conflicts
 */
router.get(
  '/my',
  authenticate,
  validate(getEventsQuerySchema, ValidationType.QUERY),
  asyncHandler(getMyEvents)
);

/**
 * GET /api/events/:eventId/participants
 * Public participant list (confirmed only)
 */
router.get(
  '/:eventId/participants',
  validate(publicEventIdParamSchema, ValidationType.PARAMS),
  asyncHandler(getPublicParticipants)
);

/**
 * GET /api/events/:id
 * Get event by ID (public)
 */
router.get('/:id', validate(eventIdSchema, ValidationType.PARAMS), asyncHandler(getEventById));

/**
 * POST /api/events
 * Create a new event (requires authentication)
 */
router.post(
  '/',
  authenticate,
  validate(createEventSchema, ValidationType.BODY),
  asyncHandler(createEvent)
);

/**
 * PUT /api/events/:id
 * Update an event (requires authentication and authorization)
 */
router.put(
  '/:id',
  authenticate,
  validate(eventIdSchema, ValidationType.PARAMS),
  isEventOrganizer,
  validate(updateEventSchema, ValidationType.BODY),
  asyncHandler(updateEvent)
);

/**
 * DELETE /api/events/:id
 * Delete an event (requires authentication and authorization)
 */
router.delete(
  '/:id',
  authenticate,
  validate(eventIdSchema, ValidationType.PARAMS),
  isEventOrganizer,
  asyncHandler(deleteEvent)
);

/**
 * GET /api/events/:id/check-registration
 * Check if user is registered for an event (requires authentication)
 */
router.get(
  '/:id/check-registration',
  authenticate,
  validate(eventIdSchema, ValidationType.PARAMS),
  asyncHandler(checkRegistration)
);

/**
 * GET /api/events/:eventId/registrations
 * Get registrations for a specific event (requires authentication and authorization)
 */
router.get(
  '/:eventId/registrations',
  authenticate,
  validate(eventIdParamSchema, ValidationType.PARAMS),
  validate(getRegistrationsQuerySchema, ValidationType.QUERY),
  asyncHandler(getEventRegistrations)
);

export default router;
