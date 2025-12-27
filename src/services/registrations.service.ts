import mongoose from 'mongoose';
import { eventConfig } from '../config/env';
import { Event } from '../models/Event';
import { IPayment, Payment } from '../models/Payment';
import { Registration } from '../models/Registration';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../types/errors';
import {
  PaginatedResponse,
  formatPaginatedResponse,
  getPaginationParams,
} from '../utils/pagination.util';
import { calculatePrice } from '../utils/pricing.util';
import paymentsService from './payments.service';
import promoCodesService from './promoCodes.service';

export interface CreateRegistrationInput {
  eventId: string;
}

export interface CreatePublicRegistrationInput {
  eventId: string;
  name: string;
  surname: string;
  email: string;
  city: string;
  runningClub?: string;
  phone?: string;
  promoCode?: string;
}

export interface RegistrationFilters {
  eventId?: string;
  status?: 'pending' | 'confirmed' | 'cancelled';
}

interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  image?: string;
}

interface PopulatedEvent {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  registeredCount: number;
  organizerId: mongoose.Types.ObjectId;
  imageUrl?: {
    portrait: string;
    landscape: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RegistrationResponse {
  id: string;
  eventId: string;
  userId?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  registeredAt: Date;
  name?: string;
  surname?: string;
  email?: string;
  city?: string;
  runningClub?: string;
  phone?: string;
  promoCode?: string;
  paymentStatus?: 'pending' | 'completed' | 'failed';
  paymentId?: string;
  finalPrice?: number;
  event?: PopulatedEvent;
  user?: PopulatedUser;
}

export interface PublicParticipant {
  id: string;
  name?: string;
  surname?: string;
  city?: string;
  runningClub?: string;
  registeredAt: Date;
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
      const registrationArray = await Registration.create(
        [
          {
            eventId,
            userId,
            status: 'confirmed',
            paymentStatus: 'completed',
            registeredAt: new Date(),
          },
        ],
        { session }
      );

      const registration = registrationArray[0];
      if (!registration) {
        throw new Error('Failed to create registration');
      }

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
   * Public registration flow (no authentication)
   * Validate event, capacity, promo code, create registration + payment
   */
  async createPublicRegistration(
    input: CreatePublicRegistrationInput
  ): Promise<{ registration: RegistrationResponse; paymentLink?: string }> {
    const { eventId, name, surname, email, city, runningClub, phone, promoCode } = input;
    const resolvedEventId = this.resolveEventId(eventId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const event = await Event.findById(resolvedEventId).session(session);
      if (!event) {
        throw new NotFoundError('Event not found');
      }

      if (!event.hasAvailableCapacity()) {
        throw new ConflictError('Event is full');
      }

      // Check if registration already exists for this email and event
      const existing = await Registration.findOne({
        eventId: resolvedEventId,
        email: email.toLowerCase(),
      }).session(session);

      if (existing) {
        // If registration exists and payment is completed/confirmed, throw error
        if (existing.status === 'confirmed' || existing.paymentStatus === 'completed') {
          throw new ConflictError('This email is already registered for the event');
        }

        // If registration exists with pending payment, return existing payment link
        if (existing.paymentStatus === 'pending' && existing.paymentId) {
          await session.abortTransaction();
          session.endSession();

          const payment = await Payment.findById(existing.paymentId);
          const responsePayload: { registration: RegistrationResponse; paymentLink?: string } = {
            registration: this.formatRegistrationResponse(existing.toObject()),
          };
          if (payment?.paymentLink) {
            responsePayload.paymentLink = payment.paymentLink;
          }

          return responsePayload;
        }

        // If registration exists but payment failed, allow retry by creating new payment
        // (fall through to create new payment)
      }

      const validatedPromo = promoCode
        ? await promoCodesService.validate(promoCode, resolvedEventId)
        : null;

      const basePrice = event.basePrice ?? eventConfig.basePrice;
      if (basePrice === undefined) {
        throw new ConflictError('Event price is not configured');
      }

      const { finalPrice } = calculatePrice(basePrice, validatedPromo);

      const registrationArray = await Registration.create(
        [
          {
            eventId: resolvedEventId,
            name,
            surname,
            email: email.toLowerCase(),
            city,
            runningClub,
            phone,
            promoCode: validatedPromo?.code ?? promoCode?.toUpperCase(),
            promoCodeId: validatedPromo?._id,
            status: 'pending',
            paymentStatus: 'pending',
            registeredAt: new Date(),
            finalPrice,
          },
        ],
        { session }
      );

      const registration = registrationArray[0];
      if (!registration) {
        throw new Error('Failed to create registration');
      }

      const { payment, paymentLink } = await paymentsService.createPaymentWithInvoice({
        registrationId: registration._id.toString(),
        amount: finalPrice,
        customerName: `${name} ${surname}`.trim(),
        eventTitle: event.title,
        session,
      });

      registration.paymentId = payment._id.toString();
      await registration.save(session ? { session } : undefined);

      await session.commitTransaction();

      const responsePayload: { registration: RegistrationResponse; paymentLink?: string } = {
        registration: this.formatRegistrationResponse(registration.toObject()),
      };
      if (paymentLink) {
        responsePayload.paymentLink = paymentLink;
      }

      return responsePayload;
    } catch (error) {
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
      if (!registration.userId || registration.userId.toString() !== userId) {
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
    const query: {
      eventId?: string;
      status?: 'pending' | 'confirmed' | 'cancelled';
    } = {};

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

    const registrationResponses = registrations.map(reg => this.formatRegistrationResponse(reg));

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

    const registrationResponses = registrations.map(reg => this.formatRegistrationResponse(reg));

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

    const registrationResponses = registrations.map(reg => this.formatRegistrationResponse(reg));

    return formatPaginatedResponse(registrationResponses, total, parsedPage, parsedLimit);
  }

  /**
   * Public list of participants (confirmed only)
   */
  async getPublicParticipants(eventId: string): Promise<PublicParticipant[]> {
    const resolvedEventId = this.resolveEventId(eventId);

    const event = await Event.findById(resolvedEventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const participants = await Registration.find({
      eventId: resolvedEventId,
      status: 'confirmed',
    })
      .select('name surname city runningClub registeredAt')
      .sort({ registeredAt: -1 })
      .lean();

    return participants.map(participant => {
      const record: PublicParticipant = {
        id: participant._id.toString(),
        registeredAt: participant.registeredAt,
      };
      if (participant.name !== undefined) record.name = participant.name;
      if (participant.surname !== undefined) record.surname = participant.surname;
      if (participant.city !== undefined) record.city = participant.city;
      if (participant.runningClub !== undefined) record.runningClub = participant.runningClub;
      return record;
    });
  }

  /**
   * Mark payment as completed and confirm registration
   */
  async markPaymentCompleted(
    payment: IPayment,
    plataPaymentId?: string,
    webhookData?: Record<string, unknown>
  ): Promise<RegistrationResponse> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const registration = await Registration.findById(payment.registrationId).session(session);
      if (!registration) {
        throw new NotFoundError('Registration not found for payment');
      }

      registration.paymentStatus = 'completed';
      registration.status = 'confirmed';
      await registration.save(session ? { session } : undefined);

      await Event.updateOne(
        { _id: registration.eventId },
        { $inc: { registeredCount: 1 } },
        { session }
      );
      const updates: Partial<Pick<IPayment, 'plataMonoPaymentId' | 'webhookData'>> = {};
      if (plataPaymentId !== undefined) {
        updates.plataMonoPaymentId = plataPaymentId;
      }
      if (webhookData !== undefined) {
        updates.webhookData = webhookData;
      }
      await paymentsService.updateStatus(payment._id.toString(), 'completed', updates, session);

      if (registration.promoCodeId) {
        await promoCodesService.incrementUsage(registration.promoCodeId.toString(), session);
      }

      await session.commitTransaction();

      return this.formatRegistrationResponse(registration.toObject());
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Mark payment as failed and keep registration pending for retry
   */
  async markPaymentFailed(
    payment: IPayment,
    webhookData?: Record<string, unknown>
  ): Promise<RegistrationResponse> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const registration = await Registration.findById(payment.registrationId).session(session);
      if (!registration) {
        throw new NotFoundError('Registration not found for payment');
      }

      registration.paymentStatus = 'failed';
      registration.status = 'pending';
      await registration.save(session ? { session } : undefined);

      const updates: Partial<Pick<IPayment, 'plataMonoPaymentId' | 'webhookData'>> = {};
      if (webhookData !== undefined) {
        updates.webhookData = webhookData;
      }

      await paymentsService.updateStatus(payment._id.toString(), 'failed', updates, session);

      await session.commitTransaction();

      return this.formatRegistrationResponse(registration.toObject());
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Process refund for a registration
   * Refunds payment and updates registration status
   */
  async processRefund(
    registrationId: string,
    amount?: number,
    extRef?: string
  ): Promise<RegistrationResponse> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const registration = await Registration.findById(registrationId).session(session);
      if (!registration) {
        throw new NotFoundError('Registration not found');
      }

      if (!registration.paymentId) {
        throw new AppError('Registration has no payment', 400);
      }

      // Refund payment
      await paymentsService.refundPayment(registration.paymentId, amount, extRef, session);

      // Update registration status
      registration.status = 'cancelled';
      registration.paymentStatus = 'failed'; // Mark as failed after refund
      await registration.save({ session });

      // Decrement event registeredCount
      await Event.updateOne(
        { _id: registration.eventId },
        { $inc: { registeredCount: -1 } },
        { session }
      );

      // Decrement promo code usage if used
      if (registration.promoCodeId) {
        await promoCodesService.decrementUsage(registration.promoCodeId.toString(), session);
      }

      await session.commitTransaction();

      return this.formatRegistrationResponse(registration.toObject());
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get payment link for existing registration by email
   * Used when user closes payment page and needs to resume payment
   */
  async getPaymentLinkByEmail(
    email: string,
    eventId: string
  ): Promise<{ registration: RegistrationResponse; paymentLink?: string } | null> {
    const resolvedEventId = this.resolveEventId(eventId);

    const registration = await Registration.findOne({
      eventId: resolvedEventId,
      email: email.toLowerCase(),
      paymentStatus: 'pending',
      status: 'pending',
    });

    if (!registration || !registration.paymentId) {
      return null;
    }

    const payment = await Payment.findById(registration.paymentId);
    if (!payment || !payment.paymentLink) {
      return null;
    }

    return {
      registration: this.formatRegistrationResponse(registration.toObject()),
      paymentLink: payment.paymentLink,
    };
  }

  /**
   * Resolve event id from input or fallback to configured single event id
   */
  private resolveEventId(eventId: string): string {
    if (mongoose.Types.ObjectId.isValid(eventId)) {
      return eventId;
    }
    if (eventConfig.singleEventId && mongoose.Types.ObjectId.isValid(eventConfig.singleEventId)) {
      return eventConfig.singleEventId;
    }
    throw new NotFoundError('Invalid event ID');
  }

  /**
   * Format registration document to response format
   */
  private formatRegistrationResponse(registration: {
    _id: mongoose.Types.ObjectId | { toString(): string };
    eventId: mongoose.Types.ObjectId | { toString(): string };
    userId?: mongoose.Types.ObjectId | { toString(): string };
    status: 'pending' | 'confirmed' | 'cancelled';
    registeredAt: Date;
    name?: string;
    surname?: string;
    email?: string;
    city?: string;
    runningClub?: string;
    phone?: string;
    promoCode?: string;
    paymentStatus?: 'pending' | 'completed' | 'failed';
    paymentId?: string;
    finalPrice?: number;
    event?: PopulatedEvent;
    user?: PopulatedUser;
  }): RegistrationResponse {
    const response: RegistrationResponse = {
      id: registration._id.toString(),
      eventId: registration.eventId.toString(),
      status: registration.status,
      registeredAt: registration.registeredAt,
    };

    if (registration.userId) {
      response.userId = registration.userId.toString();
    }
    if (registration.event !== undefined) {
      response.event = registration.event;
    }
    if (registration.user !== undefined) {
      response.user = registration.user;
    }
    if (registration.name !== undefined) response.name = registration.name;
    if (registration.surname !== undefined) response.surname = registration.surname;
    if (registration.email !== undefined) response.email = registration.email;
    if (registration.city !== undefined) response.city = registration.city;
    if (registration.runningClub !== undefined) response.runningClub = registration.runningClub;
    if (registration.phone !== undefined) response.phone = registration.phone;
    if (registration.promoCode !== undefined) response.promoCode = registration.promoCode;
    if (registration.paymentStatus !== undefined)
      response.paymentStatus = registration.paymentStatus;
    if (registration.paymentId !== undefined) response.paymentId = registration.paymentId;
    if (registration.finalPrice !== undefined) response.finalPrice = registration.finalPrice;

    return response;
  }
}

export default new RegistrationsService();
