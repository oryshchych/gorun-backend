import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import eventsService from '../services/events.service';

/**
 * Get all events with filters and pagination
 * GET /api/events
 */
export const getEvents = async (req: Request, res: Response): Promise<void> => {
  const { search, startDate, endDate, location, page, limit } = req.query;

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
    limit ? Number(limit) : undefined
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

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  const event = await eventsService.getEventById(id);

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
  const { title, description, date, location, capacity, imageUrl } = req.body;

  const event = await eventsService.createEvent(userId, {
    title,
    description,
    date: new Date(date),
    location,
    capacity,
    imageUrl,
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
  const { title, description, date, location, capacity, imageUrl } = req.body;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'Event ID is required',
    });
    return;
  }

  const updateData: {
    title?: string;
    description?: string;
    date?: Date;
    location?: string;
    capacity?: number;
    imageUrl?: string;
  } = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (date !== undefined) updateData.date = new Date(date);
  if (location !== undefined) updateData.location = location;
  if (capacity !== undefined) updateData.capacity = capacity;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

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
