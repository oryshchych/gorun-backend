import mongoose from 'mongoose';
import { Event } from '../models/Event';
import { Registration } from '../models/Registration';
import { ConflictError, ForbiddenError, NotFoundError } from '../types/errors';
import {
  PaginatedResponse,
  formatPaginatedResponse,
  getPaginationParams,
} from '../utils/pagination.util';

export interface CreateEventInput {
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  imageUrl?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  date?: Date;
  location?: string;
  capacity?: number;
  imageUrl?: string;
}

export interface EventFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
}

interface PopulatedOrganizer {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  image?: string;
}

export interface EventResponse {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  registeredCount: number;
  organizerId: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  organizer?: PopulatedOrganizer;
}

class EventsService {
  /**
   * Get events with filters and pagination
   * Apply filters (search, date range, location), paginate, populate organizer
   */
  async getEvents(
    filters: EventFilters,
    page?: number,
    limit?: number
  ): Promise<PaginatedResponse<EventResponse>> {
    const { page: parsedPage, limit: parsedLimit, skip } = getPaginationParams(page, limit);

    // Build query
    const query: {
      $text?: { $search: string };
      date?: {
        $gte?: Date;
        $lte?: Date;
      };
      location?: { $regex: string; $options: string };
    } = {};

    // Text search on title and description
    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) {
        query.date.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.date.$lte = filters.endDate;
      }
    }

    // Location filter
    if (filters.location) {
      query.location = { $regex: filters.location, $options: 'i' };
    }

    // Get total count
    const total = await Event.countDocuments(query);

    // Get events with pagination
    const events = await Event.find(query)
      .populate('organizer', 'name email image')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const eventResponses = events.map(event => this.formatEventResponse(event));

    return formatPaginatedResponse(eventResponses, total, parsedPage, parsedLimit);
  }

  /**
   * Get event by ID
   * Find by ID, populate organizer, throw NotFoundError if not exists
   */
  async getEventById(id: string): Promise<EventResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Invalid event ID');
    }

    const event = await Event.findById(id).populate('organizer', 'name email image').lean();

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    return this.formatEventResponse(event);
  }

  /**
   * Create a new event
   * Validate date is future, create event with userId as organizerId
   */
  async createEvent(userId: string, input: CreateEventInput): Promise<EventResponse> {
    // Validate date is in the future
    if (new Date(input.date) <= new Date()) {
      throw new ConflictError('Event date must be in the future');
    }

    // Create event
    const event = await Event.create({
      ...input,
      organizerId: userId,
      registeredCount: 0,
    });

    // Populate organizer
    await event.populate('organizer', 'name email image');

    return this.formatEventResponse(event.toObject());
  }

  /**
   * Update an event
   * Check ownership, validate updates, update event
   */
  async updateEvent(id: string, userId: string, input: UpdateEventInput): Promise<EventResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Invalid event ID');
    }

    // Find event
    const event = await Event.findById(id);

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Check ownership
    if (event.organizerId.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to update this event');
    }

    // Validate date if provided
    if (input.date && new Date(input.date) <= new Date()) {
      throw new ConflictError('Event date must be in the future');
    }

    // Update event
    Object.assign(event, input);
    await event.save();

    // Populate organizer
    await event.populate('organizer', 'name email image');

    return this.formatEventResponse(event.toObject());
  }

  /**
   * Delete an event
   * Check ownership, check for confirmed registrations, delete if none exist
   */
  async deleteEvent(id: string, userId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Invalid event ID');
    }

    // Find event
    const event = await Event.findById(id);

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Check ownership
    if (event.organizerId.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to delete this event');
    }

    // Check for confirmed registrations
    const confirmedRegistrations = await Registration.countDocuments({
      eventId: id,
      status: 'confirmed',
    });

    if (confirmedRegistrations > 0) {
      throw new ConflictError('Cannot delete event with confirmed registrations');
    }

    // Delete event
    await Event.deleteOne({ _id: id });
  }

  /**
   * Get events created by the user
   * Filter by organizerId, paginate, populate organizer
   */
  async getMyEvents(
    userId: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResponse<EventResponse>> {
    const { page: parsedPage, limit: parsedLimit, skip } = getPaginationParams(page, limit);

    // Build query
    const query = { organizerId: userId };

    // Get total count
    const total = await Event.countDocuments(query);

    // Get events with pagination
    const events = await Event.find(query)
      .populate('organizer', 'name email image')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const eventResponses = events.map(event => this.formatEventResponse(event));

    return formatPaginatedResponse(eventResponses, total, parsedPage, parsedLimit);
  }

  /**
   * Check if user is registered for an event
   * Query for confirmed registration
   */
  async checkUserRegistration(eventId: string, userId: string): Promise<{ isRegistered: boolean }> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Invalid event ID');
    }

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Check for confirmed registration
    const registration = await Registration.findOne({
      eventId,
      userId,
      status: 'confirmed',
    });

    return {
      isRegistered: !!registration,
    };
  }

  /**
   * Format event document to response format
   */
  private formatEventResponse(event: {
    _id: mongoose.Types.ObjectId | { toString(): string };
    title: string;
    description: string;
    date: Date;
    location: string;
    capacity: number;
    registeredCount: number;
    organizerId: mongoose.Types.ObjectId | { toString(): string };
    imageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
    organizer?: PopulatedOrganizer;
  }): EventResponse {
    const response: EventResponse = {
      id: event._id.toString(),
      title: event.title,
      description: event.description,
      date: event.date,
      location: event.location,
      capacity: event.capacity,
      registeredCount: event.registeredCount,
      organizerId: event.organizerId.toString(),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
    if (event.imageUrl !== undefined) {
      response.imageUrl = event.imageUrl;
    }
    if (event.organizer !== undefined) {
      response.organizer = event.organizer;
    }
    return response;
  }
}

export default new EventsService();
