import mongoose from 'mongoose';
import { eventConfig, paymentConfig } from '../config/env';
import { Event } from '../models/Event';
import { IPayment, Payment } from '../models/Payment';
import { Registration } from '../models/Registration';
import { EVENTS_CODES, REGISTRATIONS_CODES } from '../types/codes';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../types/errors';
import {
  PaginatedResponse,
  formatPaginatedResponse,
  getPaginationParams,
} from '../utils/pagination.util';
import { calculatePrice } from '../utils/pricing.util';
import emailService from './email.service';
import monobankService from './monobank.service';
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
      throw new NotFoundError('Invalid event ID', EVENTS_CODES.ERROR_EVENTS_INVALID_ID);
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find event
      const event = await Event.findById(eventId).session(session);

      if (!event) {
        throw new NotFoundError('Event not found', EVENTS_CODES.ERROR_EVENTS_NOT_FOUND);
      }

      // Check if event date is in the future
      if (event.date <= new Date()) {
        throw new ConflictError(
          'Cannot register for past events',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_EVENT_PAST
        );
      }

      // Check if user is already registered
      const existingRegistration = await Registration.findOne({
        eventId,
        userId,
      }).session(session);

      if (existingRegistration) {
        throw new ConflictError(
          'You are already registered for this event',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_USER
        );
      }

      // Check capacity
      if (!event.hasAvailableCapacity()) {
        throw new ConflictError(
          'Event has reached full capacity',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_EVENT_FULL
        );
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

      // Increment registeredCount (use updateOne to avoid full document validation)
      await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: 1 } }, { session });

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

      // Handle MongoDB duplicate key errors for registrations
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        (error.name === 'MongoError' || error.name === 'MongoServerError') &&
        'code' in error &&
        error.code === 11000
      ) {
        const mongoError = error as {
          keyPattern?: Record<string, number>;
          keyValue?: Record<string, unknown>;
        };
        const keyPattern = mongoError.keyPattern || {};
        const keys = Object.keys(keyPattern);

        // Check if it's a registration duplicate (eventId + email or eventId + userId)
        if (keys.includes('eventId') && (keys.includes('email') || keys.includes('userId'))) {
          if (keys.includes('email')) {
            // Try to find existing registration to check payment status
            const duplicateRegistration = await Registration.findOne({
              eventId: mongoError.keyValue?.eventId,
              email: mongoError.keyValue?.email,
            });

            if (duplicateRegistration) {
              // If payment is pending, throw specific error
              if (duplicateRegistration.paymentStatus === 'pending') {
                throw new ConflictError(
                  'You have already registered for this event, but payment is still pending. Please check your email to complete the payment.',
                  REGISTRATIONS_CODES.ERROR_REGISTRATION_PENDING_PAYMENT
                );
              }
              // If payment is completed, throw duplicate error
              throw new ConflictError(
                'This email is already registered for this event',
                REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_EMAIL
              );
            }

            // Fallback if registration not found
            throw new ConflictError(
              'This email is already registered for this event',
              REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_EMAIL
            );
          } else if (keys.includes('userId')) {
            throw new ConflictError(
              'You are already registered for this event',
              REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_USER
            );
          }
        }
      }

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
        throw new NotFoundError('Event not found', EVENTS_CODES.ERROR_EVENTS_NOT_FOUND);
      }

      if (!event.hasAvailableCapacity()) {
        throw new ConflictError('Event is full', REGISTRATIONS_CODES.ERROR_REGISTRATION_EVENT_FULL);
      }

      // Check if registration already exists for this email and event
      const existing = await Registration.findOne({
        eventId: resolvedEventId,
        email: email.toLowerCase(),
      }).session(session);

      if (existing) {
        // If registration exists and payment is completed/confirmed, throw error
        if (existing.status === 'confirmed' && existing.paymentStatus === 'completed') {
          await session.abortTransaction();
          session.endSession();
          throw new ConflictError(
            'This email is already registered for the event',
            REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_EMAIL
          );
        }

        // If registration exists with pending or failed payment, return payment link
        if (existing.paymentStatus === 'pending' || existing.paymentStatus === 'failed') {
          // Validate promo code and calculate price (same as new registration)
          const validatedPromo = promoCode
            ? await promoCodesService.validate(promoCode, resolvedEventId)
            : null;

          const basePrice = event.basePrice ?? eventConfig.basePrice;
          if (basePrice === undefined) {
            await session.abortTransaction();
            session.endSession();
            throw new ConflictError(
              'Event price is not configured',
              REGISTRATIONS_CODES.ERROR_REGISTRATION_PRICE_NOT_CONFIGURED
            );
          }

          const { finalPrice, discountAmount } = calculatePrice(basePrice, validatedPromo);

          // Special case: If new registration is free (100% discount), cancel previous payment and confirm registration
          if (finalPrice === 0) {
            // Cancel previous payment if it exists and is pending
            if (existing.paymentId) {
              const previousPayment = await Payment.findById(existing.paymentId);
              if (
                previousPayment &&
                previousPayment.status === 'pending' &&
                previousPayment.plataMonoInvoiceId
              ) {
                // Try to cancel the invoice in Monobank (non-blocking, log errors but don't fail)
                try {
                  await monobankService.cancelInvoice(previousPayment.plataMonoInvoiceId);
                  // Update payment status to failed (since it was cancelled)
                  previousPayment.status = 'failed';
                  await previousPayment.save();
                } catch (error) {
                  // Log error but continue - we'll still confirm the registration
                  // The payment will remain pending in Monobank, but registration will be confirmed
                }
              }
            }

            // Update existing registration to confirmed with free promo code
            existing.name = name;
            existing.surname = surname;
            existing.city = city;
            if (runningClub) {
              existing.runningClub = runningClub;
            }
            if (phone) {
              existing.phone = phone;
            }
            if (validatedPromo?.code) {
              existing.promoCode = validatedPromo.code;
            } else if (promoCode) {
              existing.promoCode = promoCode.toUpperCase();
            }
            if (validatedPromo?._id) {
              existing.promoCodeId = validatedPromo._id;
            }
            existing.finalPrice = 0;
            existing.status = 'confirmed';
            existing.paymentStatus = 'completed';
            await existing.save({ session });

            // Increment event registeredCount
            await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: 1 } }, { session });

            // Increment promo code usage if used
            if (validatedPromo?._id) {
              await promoCodesService.incrementUsage(validatedPromo._id.toString(), session);
            }

            await session.commitTransaction();

            // Send confirmation email for free registration (async, non-blocking)
            if (existing.email && event) {
              const emailParams: Parameters<typeof emailService.sendRegistrationConfirmation>[0] = {
                to: existing.email,
                name: `${name} ${surname}`.trim() || 'Participant',
                eventTitle: event.title,
                eventDate: event.date.toISOString(),
                eventLocation: event.location,
                paymentAmount: 0,
                paymentCurrency: paymentConfig.currency,
                registrationId: existing._id.toString(),
                basePrice,
              };

              if (discountAmount > 0) {
                emailParams.discountAmount = discountAmount;
              }
              if (validatedPromo?.code) {
                emailParams.promoCode = validatedPromo.code;
              }

              void emailService.sendRegistrationConfirmation(emailParams);
            }

            return {
              registration: this.formatRegistrationResponse(existing.toObject()),
              // No paymentLink for free registrations
            };
          }

          // If not free registration, continue with payment link logic
          await session.abortTransaction();
          session.endSession();

          // Check if existing payment link is still valid
          let paymentLink: string | undefined;
          if (existing.paymentId) {
            const payment = await Payment.findById(existing.paymentId);
            // If payment exists, has paymentLink, and is still pending in our DB
            if (payment?.paymentLink && payment.status === 'pending') {
              // Verify with Monobank API that invoice is still valid
              // Valid statuses: 'created', 'processing' (can still be paid)
              // Invalid statuses: 'success', 'failure', 'expired', 'hold'
              if (payment.plataMonoInvoiceId) {
                try {
                  const invoiceStatus = await monobankService.getInvoiceStatus(
                    payment.plataMonoInvoiceId
                  );
                  const monobankStatus = invoiceStatus?.status as string | undefined;
                  // Only use existing link if invoice is still active (created or processing)
                  if (monobankStatus === 'created' || monobankStatus === 'processing') {
                    paymentLink = payment.paymentLink;
                  }
                  // If invoice is expired/failed, we'll create a new one below
                } catch (error) {
                  // If API call fails, assume link is invalid and create new one
                  // (better to create new payment than return potentially invalid link)
                }
              } else {
                // If no invoice ID, payment link might be invalid
                // Create new payment to be safe
              }
            }
          }

          // If no valid payment link exists, create a new payment
          if (!paymentLink) {
            // Update existing registration with new data if needed
            existing.name = name;
            existing.surname = surname;
            existing.city = city;
            if (runningClub) {
              existing.runningClub = runningClub;
            }
            if (phone) {
              existing.phone = phone;
            }
            if (validatedPromo?.code) {
              existing.promoCode = validatedPromo.code;
            } else if (promoCode) {
              existing.promoCode = promoCode.toUpperCase();
            }
            if (validatedPromo?._id) {
              existing.promoCodeId = validatedPromo._id;
            }
            existing.finalPrice = finalPrice;
            existing.paymentStatus = 'pending';
            await existing.save();

            // Create new payment
            const newSession = await mongoose.startSession();
            newSession.startTransaction();
            try {
              const { payment, paymentLink: newPaymentLink } =
                await paymentsService.createPaymentWithInvoice({
                  registrationId: existing._id.toString(),
                  amount: finalPrice,
                  customerName: `${name} ${surname}`.trim(),
                  eventTitle: event.title,
                  session: newSession,
                });

              existing.paymentId = payment._id.toString();
              await existing.save({ session: newSession });
              await newSession.commitTransaction();
              paymentLink = newPaymentLink;
            } catch (error) {
              await newSession.abortTransaction();
              throw error;
            } finally {
              newSession.endSession();
            }
          }

          // Return existing registration with payment link (no email sent)
          const response: { registration: RegistrationResponse; paymentLink?: string } = {
            registration: this.formatRegistrationResponse(existing.toObject()),
          };
          if (paymentLink) {
            response.paymentLink = paymentLink;
          }
          return response;
        }
      }

      const validatedPromo = promoCode
        ? await promoCodesService.validate(promoCode, resolvedEventId)
        : null;

      const basePrice = event.basePrice ?? eventConfig.basePrice;
      if (basePrice === undefined) {
        throw new ConflictError(
          'Event price is not configured',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_PRICE_NOT_CONFIGURED
        );
      }

      const { finalPrice, discountAmount } = calculatePrice(basePrice, validatedPromo);

      // Validate final price
      if (!isFinite(finalPrice) || finalPrice < 0) {
        throw new ConflictError(
          'Invalid event price. Please contact support.',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_PRICE_NOT_CONFIGURED
        );
      }

      // Check if this is a free registration (100% discount)
      const isFreeRegistration = finalPrice === 0;

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
            status: isFreeRegistration ? 'confirmed' : 'pending',
            paymentStatus: isFreeRegistration ? 'completed' : 'pending',
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

      // For free registrations, skip payment creation and confirm immediately
      if (isFreeRegistration) {
        // Increment event registeredCount for free registration (use updateOne to avoid full document validation)
        await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: 1 } }, { session });

        // Increment promo code usage if used
        if (validatedPromo?._id) {
          await promoCodesService.incrementUsage(validatedPromo._id.toString(), session);
        }

        await session.commitTransaction();

        // Send confirmation email for free registration (async, non-blocking)
        if (registration.email && event) {
          const emailParams: Parameters<typeof emailService.sendRegistrationConfirmation>[0] = {
            to: registration.email,
            name: `${name} ${surname}`.trim() || 'Participant',
            eventTitle: event.title,
            eventDate: event.date.toISOString(),
            eventLocation: event.location,
            paymentAmount: 0,
            paymentCurrency: paymentConfig.currency,
            registrationId: registration._id.toString(),
            basePrice,
          };

          if (discountAmount > 0) {
            emailParams.discountAmount = discountAmount;
          }
          if (validatedPromo?.code) {
            emailParams.promoCode = validatedPromo.code;
          }

          void emailService.sendRegistrationConfirmation(emailParams);
        }

        return {
          registration: this.formatRegistrationResponse(registration.toObject()),
          // No paymentLink for free registrations
        };
      }

      // For paid registrations, create payment and invoice
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

      // Send payment link email (async, non-blocking)
      if (paymentLink && registration.email && event) {
        const emailParams: Parameters<typeof emailService.sendPaymentLink>[0] = {
          to: registration.email,
          name: `${name} ${surname}`.trim() || 'Participant',
          eventTitle: event.title,
          eventDate: event.date.toISOString(),
          eventLocation: event.location,
          paymentAmount: finalPrice,
          paymentCurrency: paymentConfig.currency,
          paymentLink,
          registrationId: registration._id.toString(),
          basePrice,
        };

        if (discountAmount > 0) {
          emailParams.discountAmount = discountAmount;
        }
        if (validatedPromo?.code) {
          emailParams.promoCode = validatedPromo.code;
        }

        void emailService.sendPaymentLink(emailParams);
      }

      const responsePayload: { registration: RegistrationResponse; paymentLink?: string } = {
        registration: this.formatRegistrationResponse(registration.toObject()),
      };
      if (paymentLink) {
        responsePayload.paymentLink = paymentLink;
      }

      return responsePayload;
    } catch (error) {
      await session.abortTransaction();

      // Handle MongoDB duplicate key errors for registrations
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        (error.name === 'MongoError' || error.name === 'MongoServerError') &&
        'code' in error &&
        error.code === 11000
      ) {
        const mongoError = error as {
          keyPattern?: Record<string, number>;
          keyValue?: Record<string, unknown>;
        };
        const keyPattern = mongoError.keyPattern || {};
        const keys = Object.keys(keyPattern);

        // Check if it's a registration duplicate (eventId + email or eventId + userId)
        if (keys.includes('eventId') && (keys.includes('email') || keys.includes('userId'))) {
          if (keys.includes('email')) {
            // Try to find existing registration to check payment status
            const duplicateRegistration = await Registration.findOne({
              eventId: mongoError.keyValue?.eventId,
              email: mongoError.keyValue?.email,
            });

            if (duplicateRegistration) {
              // If payment is completed and registration is confirmed, throw duplicate error
              if (
                duplicateRegistration.status === 'confirmed' &&
                duplicateRegistration.paymentStatus === 'completed'
              ) {
                throw new ConflictError(
                  'This email is already registered for the event',
                  REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_EMAIL
                );
              }

              // If payment is pending or failed, return payment link (race condition case)
              if (
                duplicateRegistration.paymentStatus === 'pending' ||
                duplicateRegistration.paymentStatus === 'failed'
              ) {
                let paymentLink: string | undefined;
                if (duplicateRegistration.paymentId) {
                  const payment = await Payment.findById(duplicateRegistration.paymentId);
                  // If payment exists, has paymentLink, and is still pending in our DB
                  if (payment?.paymentLink && payment.status === 'pending') {
                    // Verify with Monobank API that invoice is still valid
                    // Valid statuses: 'created', 'processing' (can still be paid)
                    // Invalid statuses: 'success', 'failure', 'expired', 'hold'
                    if (payment.plataMonoInvoiceId) {
                      try {
                        const invoiceStatus = await monobankService.getInvoiceStatus(
                          payment.plataMonoInvoiceId
                        );
                        const monobankStatus = invoiceStatus?.status as string | undefined;
                        // Only use existing link if invoice is still active (created or processing)
                        if (monobankStatus === 'created' || monobankStatus === 'processing') {
                          paymentLink = payment.paymentLink;
                        }
                        // If invoice is expired/failed, we'll create a new one below
                      } catch (error) {
                        // If API call fails, assume link is invalid and create new one
                        // (better to create new payment than return potentially invalid link)
                      }
                    }
                  }
                }

                // If no valid payment link exists, we need to create a new one
                // But we don't have validatedPromo/finalPrice here, so use existing registration's finalPrice
                if (!paymentLink && duplicateRegistration.finalPrice !== undefined) {
                  const newSession = await mongoose.startSession();
                  newSession.startTransaction();
                  try {
                    const event = await Event.findById(duplicateRegistration.eventId).lean();
                    if (event) {
                      const { payment, paymentLink: newPaymentLink } =
                        await paymentsService.createPaymentWithInvoice({
                          registrationId: duplicateRegistration._id.toString(),
                          amount: duplicateRegistration.finalPrice,
                          customerName:
                            `${duplicateRegistration.name ?? ''} ${duplicateRegistration.surname ?? ''}`.trim() ||
                            'Participant',
                          eventTitle: event.title,
                          session: newSession,
                        });

                      duplicateRegistration.paymentId = payment._id.toString();
                      duplicateRegistration.paymentStatus = 'pending';
                      await duplicateRegistration.save({ session: newSession });
                      await newSession.commitTransaction();
                      paymentLink = newPaymentLink;
                    }
                  } catch (createError) {
                    await newSession.abortTransaction();
                    // If payment creation fails, just return existing registration without payment link
                  } finally {
                    newSession.endSession();
                  }
                }

                const response: { registration: RegistrationResponse; paymentLink?: string } = {
                  registration: this.formatRegistrationResponse(duplicateRegistration.toObject()),
                };
                if (paymentLink) {
                  response.paymentLink = paymentLink;
                }
                return response;
              }

              // Fallback: throw duplicate error
              throw new ConflictError(
                'This email is already registered for the event',
                REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_EMAIL
              );
            }

            // Fallback if registration not found
            throw new ConflictError(
              'This email is already registered for the event',
              REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_EMAIL
            );
          } else if (keys.includes('userId')) {
            throw new ConflictError(
              'You are already registered for this event',
              REGISTRATIONS_CODES.ERROR_REGISTRATION_DUPLICATE_USER
            );
          }
        }
      }

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
      throw new NotFoundError(
        'Invalid registration ID',
        REGISTRATIONS_CODES.ERROR_REGISTRATION_INVALID_ID
      );
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find registration
      const registration = await Registration.findById(id).session(session);

      if (!registration) {
        throw new NotFoundError(
          'Registration not found',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_NOT_FOUND
        );
      }

      // Check ownership
      if (!registration.userId || registration.userId.toString() !== userId) {
        throw new ForbiddenError(
          'You are not authorized to cancel this registration',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_FORBIDDEN
        );
      }

      // Check if already cancelled
      if (registration.status === 'cancelled') {
        throw new ConflictError(
          'Registration is already cancelled',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_ALREADY_CANCELLED
        );
      }

      // Update registration status
      registration.status = 'cancelled';
      await registration.save({ session });

      // Decrement registeredCount (use updateOne to avoid full document validation)
      await Event.findByIdAndUpdate(
        registration.eventId,
        { $inc: { registeredCount: -1 } },
        { session }
      );

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
      throw new NotFoundError('Invalid event ID', EVENTS_CODES.ERROR_EVENTS_INVALID_ID);
    }

    // Find event and verify ownership
    const event = await Event.findById(eventId);

    if (!event) {
      throw new NotFoundError('Event not found', EVENTS_CODES.ERROR_EVENTS_NOT_FOUND);
    }

    // Check if user is the organizer
    if (event.organizerId.toString() !== userId) {
      throw new ForbiddenError(
        'You are not authorized to view registrations for this event',
        REGISTRATIONS_CODES.ERROR_REGISTRATION_FORBIDDEN
      );
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
      throw new NotFoundError('Event not found', EVENTS_CODES.ERROR_EVENTS_NOT_FOUND);
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
        throw new NotFoundError(
          'Registration not found for payment',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_NOT_FOUND
        );
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
        throw new NotFoundError(
          'Registration not found for payment',
          REGISTRATIONS_CODES.ERROR_REGISTRATION_NOT_FOUND
        );
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
        throw new AppError(
          'Registration has no payment',
          400,
          REGISTRATIONS_CODES.ERROR_REGISTRATION_NO_PAYMENT
        );
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
   * Sync payment status from Monobank API
   * Fallback mechanism if webhook was missed
   */
  async syncPaymentStatus(registrationId: string): Promise<{
    registration: RegistrationResponse;
    statusChanged: boolean;
    previousStatus: string;
    newStatus: string;
  }> {
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      throw new NotFoundError(
        'Registration not found',
        REGISTRATIONS_CODES.ERROR_REGISTRATION_NOT_FOUND
      );
    }

    if (!registration.paymentId) {
      throw new AppError(
        'Registration has no payment',
        400,
        REGISTRATIONS_CODES.ERROR_REGISTRATION_NO_PAYMENT
      );
    }

    const payment = await Payment.findById(registration.paymentId);
    if (!payment) {
      throw new NotFoundError(
        'Payment not found',
        REGISTRATIONS_CODES.ERROR_REGISTRATION_NOT_FOUND
      );
    }

    if (!payment.plataMonoInvoiceId) {
      throw new AppError(
        'Payment has no invoice ID',
        400,
        REGISTRATIONS_CODES.ERROR_REGISTRATION_NO_PAYMENT
      );
    }

    // If already completed, no need to sync
    if (payment.status === 'completed' && registration.status === 'confirmed') {
      return {
        registration: this.formatRegistrationResponse(registration.toObject()),
        statusChanged: false,
        previousStatus: payment.status,
        newStatus: payment.status,
      };
    }

    // Check status from Monobank API
    const statusData = await paymentsService.checkPaymentStatus(payment._id.toString());
    if (!statusData) {
      throw new AppError(
        'Failed to get payment status from Monobank',
        502,
        REGISTRATIONS_CODES.ERROR_REGISTRATION_NO_PAYMENT
      );
    }

    const monobankStatus = statusData.status as string | undefined;
    const isSuccess = monobankStatus === 'success';

    const previousPaymentStatus = payment.status;

    // Only update if status is 'success' and payment is not already completed
    if (isSuccess && payment.status !== 'completed') {
      await this.markPaymentCompleted(
        payment,
        statusData.paymentId as string | undefined,
        statusData as Record<string, unknown>
      );

      // Reload registration to get updated status
      await registration.populate('eventId');
      const updatedRegistration = await Registration.findById(registrationId);

      return {
        registration: this.formatRegistrationResponse(
          updatedRegistration?.toObject() || registration.toObject()
        ),
        statusChanged: true,
        previousStatus: previousPaymentStatus,
        newStatus: 'completed',
      };
    }

    // If status is failure and payment is not already failed
    if (monobankStatus === 'failure' && payment.status !== 'failed') {
      await this.markPaymentFailed(payment, statusData as Record<string, unknown>);

      const updatedRegistration = await Registration.findById(registrationId);
      return {
        registration: this.formatRegistrationResponse(
          updatedRegistration?.toObject() || registration.toObject()
        ),
        statusChanged: true,
        previousStatus: previousPaymentStatus,
        newStatus: 'failed',
      };
    }

    // No change needed
    return {
      registration: this.formatRegistrationResponse(registration.toObject()),
      statusChanged: false,
      previousStatus: previousPaymentStatus,
      newStatus: payment.status,
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
    throw new NotFoundError('Invalid event ID', EVENTS_CODES.ERROR_EVENTS_INVALID_ID);
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
