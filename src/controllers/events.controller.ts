import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import eventsService, { UpdateEventInput } from '../services/events.service';

const getRequestedLang = (req: Request): 'en' | 'uk' | undefined => {
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
export const getEvents = async (req: Request, res: Response): Promise<void> => {
  const { search, startDate, endDate, location, page, limit } = req.query;
  const lang = getRequestedLang(req);

  // Build filters object, only including defined values
  const filters: {
    search?: string;
    startDate?: Date;
    endDate?: Date;
    location?: string;
  } = {};
  if (search) filters.search = search as string;
  if (startDate) filters.startDate = new Date(startDate as string);
  if (endDate) filters.endDate = new Date(endDate as string);
  if (location) filters.location = location as string;

  const result = await eventsService.getEvents(
    filters,
    page ? Number(page) : undefined,
    limit ? Number(limit) : undefined,
    lang
  );

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
export const getEventById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const lang = getRequestedLang(req);

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  const event = await eventsService.getEventById(id, lang);

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
  const {
    translations,
    title,
    description,
    date,
    location,
    capacity,
    imageUrl,
    basePrice,
    speakers,
    gallery,
  } = req.body;

  const event = await eventsService.createEvent(userId, {
    translations,
    title,
    description,
    date: new Date(date),
    location,
    capacity,
    imageUrl,
    basePrice,
    speakers,
    gallery,
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
  const { id } = req.params;
  const userId = req.user!.userId;
  const {
    translations,
    title,
    description,
    date,
    location,
    capacity,
    imageUrl,
    basePrice,
    speakers,
    gallery,
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
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (basePrice !== undefined) updateData.basePrice = basePrice;
  if (speakers !== undefined) updateData.speakers = speakers;
  if (gallery !== undefined) updateData.gallery = gallery;

  const event = await eventsService.updateEvent(id, userId, updateData);

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
  const { id } = req.params;
  const userId = req.user!.userId;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  await eventsService.deleteEvent(id, userId);

  res.status(204).send();
};

/**
 * Get events created by the authenticated user
 * GET /api/events/my
 */
export const getMyEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { page, limit } = req.query;

  const result = await eventsService.getMyEvents(
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
 * Check if user is registered for an event
 * GET /api/events/:id/check-registration
 */
export const checkRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
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
