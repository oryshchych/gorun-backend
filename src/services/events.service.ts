import mongoose from 'mongoose';
import { eventConfig } from '../config/env';
import { Event, IEvent, Speaker } from '../models/Event';
import { Registration } from '../models/Registration';
import { ConflictError, ForbiddenError, NotFoundError } from '../types/errors';
import {
  PaginatedResponse,
  formatPaginatedResponse,
  getPaginationParams,
} from '../utils/pagination.util';

export type TranslationFields = {
  title?: { en?: string; uk?: string };
  description?: { en?: string; uk?: string };
  location?: { en?: string; uk?: string };
  speakers?: Array<{ en?: string; uk?: string }>;
  date?: { en?: string; uk?: string };
};
export interface CreateEventInput {
  translations: TranslationFields;
  title?: string;
  description?: string;
  date: Date;
  location?: string;
  capacity: number;
  imageUrl?: {
    portrait: string;
    landscape: string;
  };
  basePrice?: number;
  speakers?: Speaker[];
  gallery?: string[];
  map?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface UpdateEventInput {
  translations?: TranslationFields;
  title?: string;
  description?: string;
  date?: Date;
  location?: string;
  capacity?: number;
  imageUrl?: {
    portrait: string;
    landscape: string;
  };
  basePrice?: number;
  speakers?: Speaker[];
  gallery?: string[];
  map?: {
    latitude?: number;
    longitude?: number;
  };
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
  translations: TranslationFields;
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  registeredCount: number;
  organizerId?: string;
  imageUrl?: {
    portrait: string;
    landscape: string;
  };
  basePrice?: number;
  speakers?: Speaker[];
  gallery?: string[];
  map?: {
    latitude?: number;
    longitude?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  organizer?: PopulatedOrganizer;
  resolvedTitle?: string;
  resolvedDescription?: string;
  resolvedLocation?: string;
  resolvedSpeakers?: string[];
  resolvedDate?: string;
}

class EventsService {
  /**
   * Get events with filters and pagination
   * Apply filters (search, date range, location), paginate, populate organizer
   */
  async getEvents(
    filters: EventFilters,
    page?: number,
    limit?: number,
    lang?: 'en' | 'uk'
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

    const eventResponses = events.map(event => this.formatEventResponse(event, lang));

    return formatPaginatedResponse(eventResponses, total, parsedPage, parsedLimit);
  }

  /**
   * Get the single configured event for the public MVP
   */
  async getSingleEvent(lang?: 'en' | 'uk'): Promise<EventResponse> {
    let event = null;

    if (eventConfig.singleEventId && mongoose.Types.ObjectId.isValid(eventConfig.singleEventId)) {
      event = await Event.findById(eventConfig.singleEventId).lean();
    }

    if (!event) {
      event = await Event.findOne().sort({ createdAt: 1 }).lean();
    }

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    return this.formatEventResponse(event, lang);
  }

  /**
   * Get event by ID
   * Find by ID, populate organizer, throw NotFoundError if not exists
   */
  async getEventById(id: string, lang?: 'en' | 'uk'): Promise<EventResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Invalid event ID');
    }

    const event = await Event.findById(id).populate('organizer', 'name email image').lean();

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    return this.formatEventResponse(event, lang);
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

    const normalized = this.normalizeTranslationsForWrite(input);

    // Create event
    const event = await Event.create({
      translations: normalized.translations,
      title: normalized.legacyTitle,
      description: normalized.legacyDescription,
      location: normalized.legacyLocation,
      speakers: normalized.speakers,
      date: input.date,
      capacity: input.capacity,
      imageUrl: input.imageUrl,
      basePrice: input.basePrice,
      gallery: input.gallery,
      map: input.map,
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

    const merged = this.mergeTranslationsForUpdate(event.toObject(), input);

    Object.assign(event, merged.updateFields);
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
  private formatEventResponse(
    event: {
      _id: mongoose.Types.ObjectId | { toString(): string };
      translations?:
        | {
            title?: { en?: string; uk?: string };
            description?: { en?: string; uk?: string };
            location?: { en?: string; uk?: string };
            speakers?: Array<{ en?: string; uk?: string }>;
          }
        | undefined;
      title: string;
      description: string;
      date: Date;
      location: string;
      capacity: number;
      registeredCount: number;
      organizerId?: mongoose.Types.ObjectId | { toString(): string } | undefined;
      imageUrl?:
        | {
            portrait: string;
            landscape: string;
          }
        | undefined;
      basePrice?: number | undefined;
      speakers?: Speaker[] | undefined;
      gallery?: string[] | undefined;
      map?:
        | {
            latitude?: number;
            longitude?: number;
          }
        | undefined;
      createdAt: Date;
      updatedAt: Date;
      organizer?: PopulatedOrganizer | undefined;
    },
    lang?: 'en' | 'uk'
  ): EventResponse {
    const translations = this.buildTranslations(event);
    const resolved = this.resolveByLang(translations, lang);
    const response: EventResponse = {
      id: event._id.toString(),
      translations,
      title: event.title,
      description: event.description,
      date: event.date,
      location: event.location,
      capacity: event.capacity,
      registeredCount: event.registeredCount,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
    if (resolved.title !== undefined) response.resolvedTitle = resolved.title;
    if (resolved.description !== undefined) response.resolvedDescription = resolved.description;
    if (resolved.location !== undefined) response.resolvedLocation = resolved.location;
    if (resolved.speakers !== undefined) response.resolvedSpeakers = resolved.speakers;
    if (event.organizerId !== undefined) {
      response.organizerId = event.organizerId.toString();
    }
    if (event.imageUrl !== undefined) {
      response.imageUrl = event.imageUrl;
    }
    if (event.basePrice !== undefined) {
      response.basePrice = event.basePrice;
    }
    if (event.speakers !== undefined) {
      response.speakers = event.speakers;
    }
    if (event.gallery !== undefined) {
      response.gallery = event.gallery;
    }
    if (event.map !== undefined) {
      response.map = event.map;
    }
    if (event.organizer !== undefined) {
      response.organizer = event.organizer;
    }
    if (resolved.date !== undefined) response.resolvedDate = resolved.date;
    return response;
  }

  /**
   * Normalize translations input to persist both translations and legacy fields
   */
  private normalizeTranslationsForWrite(input: CreateEventInput): {
    translations: EventResponse['translations'];
    legacyTitle: string;
    legacyDescription: string;
    legacyLocation: string;
    speakers?: Speaker[];
  } {
    const translations = input.translations;
    const legacyTitle = input.title ?? translations.title?.en ?? '';
    const legacyDescription = input.description ?? translations.description?.en ?? '';
    const legacyLocation = input.location ?? translations.location?.en ?? '';
    const speakers = input.speakers ?? undefined;

    const result: {
      translations: EventResponse['translations'];
      legacyTitle: string;
      legacyDescription: string;
      legacyLocation: string;
      speakers?: Speaker[];
    } = {
      translations,
      legacyTitle,
      legacyDescription,
      legacyLocation,
    };

    if (speakers !== undefined) {
      result.speakers = speakers;
    }

    return result;
  }

  /**
   * Merge existing translations with update payload and keep legacy in sync
   */
  private mergeTranslationsForUpdate(
    existing: {
      translations?:
        | {
            title?: { en?: string; uk?: string };
            description?: { en?: string; uk?: string };
            location?: { en?: string; uk?: string };
            speakers?: Array<{ en?: string; uk?: string }>;
          }
        | undefined;
      title: string;
      description: string;
      location: string;
      speakers?: Speaker[];
    },
    input: UpdateEventInput
  ): {
    updateFields: Partial<IEvent>;
  } {
    const currentTranslations = this.buildTranslations(existing);

    const mergedTranslations: EventResponse['translations'] = {
      title: { ...(currentTranslations.title ?? {}), ...(input.translations?.title ?? {}) },
      description: {
        ...(currentTranslations.description ?? {}),
        ...(input.translations?.description ?? {}),
      },
      location: {
        ...(currentTranslations.location ?? {}),
        ...(input.translations?.location ?? {}),
      },
      date: { ...(currentTranslations.date ?? {}), ...(input.translations?.date ?? {}) },
    };
    if (input.translations?.speakers !== undefined) {
      mergedTranslations.speakers = input.translations.speakers;
    } else if (currentTranslations.speakers !== undefined) {
      mergedTranslations.speakers = currentTranslations.speakers;
    }

    const legacyTitle = input.title ?? mergedTranslations.title?.en ?? existing.title;
    const legacyDescription =
      input.description ?? mergedTranslations.description?.en ?? existing.description;
    const legacyLocation = input.location ?? mergedTranslations.location?.en ?? existing.location;
    const speakers = input.speakers ?? existing.speakers;

    const updateFields: Partial<IEvent> = {
      translations: mergedTranslations,
      title: legacyTitle,
      description: legacyDescription,
      location: legacyLocation,
    };
    if (speakers !== undefined) {
      updateFields.speakers = speakers;
    }
    if (input.date !== undefined) updateFields.date = input.date;
    if (input.capacity !== undefined) updateFields.capacity = input.capacity;
    if (input.imageUrl !== undefined) updateFields.imageUrl = input.imageUrl;
    if (input.basePrice !== undefined) updateFields.basePrice = input.basePrice;
    if (input.gallery !== undefined) updateFields.gallery = input.gallery;
    if (input.map !== undefined) updateFields.map = input.map;

    return { updateFields };
  }

  /**
   * Build a consistent translations object from stored doc with fallbacks
   */
  private buildTranslations(event: {
    translations?:
      | {
          title?: { en?: string; uk?: string };
          description?: { en?: string; uk?: string };
          location?: { en?: string; uk?: string };
          speakers?: Array<{ en?: string; uk?: string }>;
          date?: { en?: string; uk?: string };
        }
      | undefined;
    title: string;
    description: string;
    location: string;
    speakers?: Speaker[] | undefined;
  }): EventResponse['translations'] {
    const t: TranslationFields = (event.translations ?? {}) as TranslationFields;
    const speakers =
      t.speakers ??
      (event.speakers
        ? event.speakers.map(s => {
            const result: { en?: string; uk?: string } = {
              en: s.translations?.fullname?.en ?? s.fullname,
            };
            if (s.translations?.fullname?.uk !== undefined) {
              result.uk = s.translations.fullname.uk;
            }
            return result;
          })
        : undefined);
    const translations: EventResponse['translations'] = {
      title: {
        en: t.title?.en ?? event.title,
        uk: t.title?.uk ?? '',
      },
      description: {
        en: t.description?.en ?? event.description,
        uk: t.description?.uk ?? '',
      },
      location: {
        en: t.location?.en ?? event.location,
        uk: t.location?.uk ?? '',
      },
      date: {
        en: t.date?.en ?? '',
        uk: t.date?.uk ?? '',
      },
    };
    if (speakers !== undefined) {
      translations.speakers = speakers;
    }
    return translations;
  }

  /**
   * Resolve locale-aware fields based on lang with English fallback
   */
  private resolveByLang(
    translations: EventResponse['translations'],
    lang?: 'en' | 'uk'
  ): {
    title?: string;
    description?: string;
    location?: string;
    speakers?: string[];
    date?: string;
  } {
    const pick = (en?: string, uk?: string) => {
      if (lang === 'uk' && uk && uk.trim().length > 0) return uk;
      return en;
    };

    const speakers =
      translations.speakers?.map(s => pick(s.en, s.uk)).filter((v): v is string => !!v) ??
      undefined;

    const result: {
      title?: string;
      description?: string;
      location?: string;
      speakers?: string[];
      date?: string;
    } = {};
    const title = pick(translations.title?.en, translations.title?.uk);
    const description = pick(translations.description?.en, translations.description?.uk);
    const location = pick(translations.location?.en, translations.location?.uk);
    const date = pick(translations.date?.en, translations.date?.uk);
    if (title !== undefined) result.title = title;
    if (description !== undefined) result.description = description;
    if (location !== undefined) result.location = location;
    if (speakers !== undefined) result.speakers = speakers;
    if (date !== undefined) result.date = date;
    return result;
  }
}

export default new EventsService();
