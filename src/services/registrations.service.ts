import mongoose from 'mongoose';
import { Event } from '../models/Event';
import { Registration } from '../models/Registration';
import { NotFoundError, ForbiddenError, ConflictError } from '../types/errors';
import { getPaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination.util';

export interface CreateRegistrationInput {
  eventId: string;
}

export interface RegistrationFilters {
  eventId?: string;
  status?: 'confirmed' | 'cancelled';
}

export interface RegistrationResponse {
  id: string;
  eventId: string;
  userId: string;
  status: 'confirmed' | 'cancelled';
  registeredAt: Date;
  event?: any;
  user?: any;
}

class RegistrationsService {
  /**
   * Create a new registration
   * Verify event exists and is future, check not already registered, check capacity,
   * create registration and increment registeredCount in transaction
   */
  async createRegistration(
    userId: string,
    input: CreateRegistrationInput
  ): Promise<RegistrationResponse> {
    const { eventId } = input;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Invalid event ID');
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find event
      const event = await Event.findById(eventId).session(session);

      if (!event) {
        throw new NotFoundError('Event not found');
      }

      // Check if event date is in the future
      if (event.date <= new Date()) {
        throw new ConflictError('Cannot register for past events');
      }

      // Check if user is already registered
      const existingRegistration = await Registration.findOne({
        eventId,
        userId,
      }).session(session);

      if (existingRegistration) {
        throw new ConflictError('You are already registered for this event');
      }

      // Check capacity
      if (!event.hasAvailableCapacity()) {
        throw new ConflictError('Event has reached full capacity');
      }

      // Create registration
      const [registration] = await Registration.create(
        [
          {
            eventId,
            userId,
            status: 'confirmed',
            registeredAt: new Date(),
          },
        ],
        { session }
      );

      // Increment registeredCount
      event.registeredCount += 1;
      await event.save({ session });

      // Commit transaction
      await session.commitTransaction();

      // Populate event and user
      await registration.populate([
        { path: 'event' },
        { path: 'user', select: 'name email image' },
      ]);

      return this.formatRegistrationResponse(registration.toObject());
    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel a registration
   * Verify ownership, update status to cancelled and decrement registeredCount in transaction
   */
  async cancelRegistration(id: string, userId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Invalid registration ID');
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find registration
      const registration = await Registration.findById(id).session(session);

      if (!registration) {
        throw new NotFoundError('Registration not found');
      }

      // Check ownership
      if (registration.userId.toString() !== userId) {
        throw new ForbiddenError('You are not authorized to cancel this registration');
      }

      // Check if already cancelled
      if (registration.status === 'cancelled') {
        throw new ConflictError('Registration is already cancelled');
      }

      // Update registration status
      registration.status = 'cancelled';
      await registration.save({ session });

      // Decrement registeredCount
      const event = await Event.findById(registration.eventId).session(session);
      if (event) {
        event.registeredCount = Math.max(0, event.registeredCount - 1);
        await event.save({ session });
      }

      // Commit transaction
      await session.commitTransaction();
    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get registrations with filters and pagination
   * Apply filters, paginate, populate event and user
   */
  async getRegistrations(
    filters: RegistrationFilters,
    page?: number,
    limit?: number
  ): Promise<PaginatedResponse<RegistrationResponse>> {
    const { page: parsedPage, limit: parsedLimit, skip } = getPaginationParams(page, limit);

    // Build query
    const query: any = {};

    if (filters.eventId) {
      if (!mongoose.Types.ObjectId.isValid(filters.eventId)) {
        throw new NotFoundError('Invalid event ID');
      }
      query.eventId = filters.eventId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    // Get total count
    const total = await Registration.countDocuments(query);

    // Get registrations with pagination
    const registrations = await Registration.find(query)
      .populate('event')
      .populate('user', 'name email image')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const registrationResponses = registrations.map(reg =>
      this.formatRegistrationResponse(reg)
    );

    return formatPaginatedResponse(registrationResponses, total, parsedPage, parsedLimit);
  }

  /**
   * Get registrations for the authenticated user
   * Filter by userId, paginate, populate event and user
   */
  async getMyRegistrations(
    userId: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResponse<RegistrationResponse>> {
    const { page: parsedPage, limit: parsedLimit, skip } = getPaginationParams(page, limit);

    // Build query
    const query = { userId };

    // Get total count
    const total = await Registration.countDocuments(query);

    // Get registrations with pagination
    const registrations = await Registration.find(query)
      .populate('event')
      .populate('user', 'name email image')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const registrationResponses = registrations.map(reg =>
      this.formatRegistrationResponse(reg)
    );

    return formatPaginatedResponse(registrationResponses, total, parsedPage, parsedLimit);
  }

  /**
   * Get registrations for a specific event
   * Verify user is organizer, filter by eventId, paginate, populate user
   */
  async getEventRegistrations(
    eventId: string,
    userId: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResponse<RegistrationResponse>> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError('Invalid event ID');
    }

    // Find event and verify ownership
    const event = await Event.findById(eventId);

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Check if user is the organizer
    if (event.organizerId.toString() !== userId) {
      throw new ForbiddenError('You are not authorized to view registrations for this event');
    }

    const { page: parsedPage, limit: parsedLimit, skip } = getPaginationParams(page, limit);

    // Build query
    const query = { eventId };

    // Get total count
    const total = await Registration.countDocuments(query);

    // Get registrations with pagination
    const registrations = await Registration.find(query)
      .populate('event')
      .populate('user', 'name email image')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const registrationResponses = registrations.map(reg =>
      this.formatRegistrationResponse(reg)
    );

    return formatPaginatedResponse(registrationResponses, total, parsedPage, parsedLimit);
  }

  /**
   * Format registration document to response format
   */
  private formatRegistrationResponse(registration: any): RegistrationResponse {
    return {
      id: registration._id.toString(),
      eventId: registration.eventId.toString(),
      userId: registration.userId.toString(),
      status: registration.status,
      registeredAt: registration.registeredAt,
      event: registration.event,
      user: registration.user,
    };
  }
}

export default new RegistrationsService();
