import { Request, Response } from 'express';
import type { z } from 'zod';
import { AuthRequest } from '../middleware/auth.middleware';
import eventsService, { EventFilters, UpdateEventInput } from '../services/events/events.service';
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
  const {
    translations,
    title,
    description,
    date,
    location,
    capacity,
    isActive,
    lifecyclePhase,
    status,
    slug,
    shortDesc,
    city,
    venue,
    dateLabel,
    timeLabel,
    cover,
    fee,
    afu,
    perks,
    spots,
    imageUrl,
    basePrice,
    speakers,
    gallery,
    distances,
    kidsDistances,
    schedule,
    program,
    map,
  } = req.body;

  const event = await eventsService.createEvent(
    userId,
    {
      translations,
      title,
      description,
      date: new Date(date),
      location,
      capacity,
      isActive,
      lifecyclePhase,
      status,
      slug,
      shortDesc,
      city,
      venue,
      dateLabel,
      timeLabel,
      cover,
      fee,
      afu,
      perks,
      spots,
      imageUrl,
      basePrice,
      speakers,
      gallery,
      distances,
      kidsDistances,
      schedule,
      program,
      map,
    },
    isAdmin
  );

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
  const {
    translations,
    title,
    description,
    date,
    location,
    capacity,
    isActive,
    lifecyclePhase,
    status,
    slug,
    shortDesc,
    city,
    venue,
    dateLabel,
    timeLabel,
    cover,
    fee,
    afu,
    perks,
    spots,
    imageUrl,
    basePrice,
    speakers,
    gallery,
    distances,
    kidsDistances,
    schedule,
    program,
    map,
  } = req.body;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  const updateData: UpdateEventInput = {};
  if (translations !== undefined) updateData.translations = translations;
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (date !== undefined) updateData.date = new Date(date);
  if (location !== undefined) updateData.location = location;
  if (capacity !== undefined) updateData.capacity = capacity;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (lifecyclePhase !== undefined) updateData.lifecyclePhase = lifecyclePhase;
  if (status !== undefined) updateData.status = status;
  if (slug !== undefined) updateData.slug = slug;
  if (shortDesc !== undefined) updateData.shortDesc = shortDesc;
  if (city !== undefined) updateData.city = city;
  if (venue !== undefined) updateData.venue = venue;
  if (dateLabel !== undefined) updateData.dateLabel = dateLabel;
  if (timeLabel !== undefined) updateData.timeLabel = timeLabel;
  if (cover !== undefined) updateData.cover = cover;
  if (fee !== undefined) updateData.fee = fee;
  if (afu !== undefined) updateData.afu = afu;
  if (perks !== undefined) updateData.perks = perks;
  if (spots !== undefined) updateData.spots = spots;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (basePrice !== undefined) updateData.basePrice = basePrice;
  if (speakers !== undefined) updateData.speakers = speakers;
  if (gallery !== undefined) updateData.gallery = gallery;
  if (distances !== undefined) updateData.distances = distances;
  if (kidsDistances !== undefined) updateData.kidsDistances = kidsDistances;
  if (schedule !== undefined) updateData.schedule = schedule;
  if (program !== undefined) updateData.program = program;
  if (map !== undefined) updateData.map = map;

  const event = await eventsService.updateEvent(id, userId, updateData, isAdmin);

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

  await eventsService.deleteEvent(id, userId, isAdmin);

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
