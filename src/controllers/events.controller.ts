import { Request, Response } from 'express';
import type { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import { Event } from '../models/Event';
import eventsService, {
  CreateEventInput,
  EventFilters,
  UpdateEventInput,
} from '../services/events/events.service';
import { pickDefined } from '../utils/pickDefined.util';
import { writeAuditLog } from '../utils/audit.util';
import { getEventsQuerySchema } from '../validators/events.validator';

type GetEventsQuery = z.infer<typeof getEventsQuerySchema>;

const getRequestedLang = (req: Request): 'en' | 'uk' | undefined => {
  const fromQ = req.validatedQuery as { lang?: 'en' | 'uk' } | undefined;
  if (fromQ?.lang === 'en' || fromQ?.lang === 'uk') return fromQ.lang;

  const queryLang = (req.query.lang as string | undefined)?.toLowerCase();
  if (queryLang === 'en' || queryLang === 'uk') return queryLang;
  const headerLang = req.headers['accept-language'];
  if (typeof headerLang === 'string') {
    if (headerLang.toLowerCase().includes('uk')) return 'uk';
    if (headerLang.toLowerCase().includes('en')) return 'en';
  }
  return undefined;
};

/**
 * Get the single public event
 * GET /api/events/single
 */
export const getSingleEvent = async (_req: Request, res: Response): Promise<void> => {
  const lang = getRequestedLang(_req);
  const event = await eventsService.getSingleEvent(lang);

  res.status(200).json({
    success: true,
    data: event,
  });
};

/**
 * Get all events with filters and pagination
 * GET /api/events
 */
export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = req.validatedQuery as GetEventsQuery;
  const { search, startDate, endDate, location, page, limit, status, lifecyclePhase, isActive } = q;
  const lang = getRequestedLang(req);
  const isAdmin = req.user?.isAdmin ?? false;

  const filters: EventFilters = {};
  if (search) filters.search = search;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (location) filters.location = location;
  if (status) filters.status = status;
  if (lifecyclePhase) filters.lifecyclePhase = lifecyclePhase;
  if (isActive !== undefined) filters.isActive = isActive;

  const result = await eventsService.getEvents(filters, page, limit, lang, isAdmin);

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get event by ID
 * GET /api/events/:id
 */
export const getEventById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const lang = getRequestedLang(req);
  const isAdmin = req.user?.isAdmin ?? false;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  const event = await eventsService.getEventById(id, lang, isAdmin);

  res.status(200).json({
    success: true,
    data: event,
  });
};

/**
 * Create a new event
 * POST /api/events
 */
export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const isAdmin = req.user?.isAdmin ?? false;

  // The validator already coerces `date` to a Date and strips unknown keys, so
  // the validated body maps cleanly onto CreateEventInput.
  const input = pickDefined<CreateEventInput>(req.body);

  const event = await eventsService.createEvent(userId, input, isAdmin);

  void writeAuditLog({
    req,
    action: 'CREATE',
    entity: 'Event',
    entityId: (event as { id?: string; _id?: { toString(): string } }).id ?? '',
    entityLabel:
      (event as { title?: string; resolvedTitle?: string }).resolvedTitle ??
      (event as { title?: string }).title ??
      'Event',
    after: event as unknown as Record<string, unknown>,
  });

  res.status(201).json({
    success: true,
    data: event,
  });
};

/**
 * Update an event
 * PUT /api/events/:id
 */
export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const userId = req.user!.userId;
  const isAdmin = req.user?.isAdmin ?? false;

  const before = await Event.findById(id).lean();
  const updateData = pickDefined<UpdateEventInput>(req.body);
  const event = await eventsService.updateEvent(id, userId, updateData, isAdmin);
  const after = await Event.findById(id).lean();

  void writeAuditLog({
    req,
    action: 'UPDATE',
    entity: 'Event',
    entityId: id,
    entityLabel:
      (event as { resolvedTitle?: string; title?: string }).resolvedTitle ??
      (event as { title?: string }).title ??
      id,
    before: (before ?? {}) as Record<string, unknown>,
    after: (after ?? {}) as Record<string, unknown>,
  });

  res.status(200).json({
    success: true,
    data: event,
  });
};

/**
 * Delete an event
 * DELETE /api/events/:id
 */
export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const userId = req.user!.userId;
  const isAdmin = req.user?.isAdmin ?? false;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  const before = await Event.findById(id).lean();
  await eventsService.deleteEvent(id, userId, isAdmin);

  void writeAuditLog({
    req,
    action: 'DELETE',
    entity: 'Event',
    entityId: id,
    entityLabel: (before as { title?: string } | null)?.title ?? id,
    before: (before ?? {}) as Record<string, unknown>,
  });

  res.status(204).send();
};

/**
 * Get events created by the authenticated user
 * GET /api/events/my
 */
export const getMyEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { page, limit } = req.validatedQuery as GetEventsQuery;

  const result = await eventsService.getMyEvents(userId, page, limit);

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Check if user is registered for an event
 * GET /api/events/:id/check-registration
 */
export const checkRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const userId = req.user!.userId;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  const result = await eventsService.checkUserRegistration(id, userId);

  res.status(200).json({
    success: true,
    data: result,
  });
};
