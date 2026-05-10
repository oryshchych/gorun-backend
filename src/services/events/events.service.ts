import mongoose from 'mongoose';
import { eventConfig } from '../../config/env';
import { Event, IEvent, Speaker } from '../../models/Event';
import { Registration } from '../../models/Registration';
import { ConflictError, ForbiddenError, NotFoundError } from '../../types/errors';
import {
  PaginatedResponse,
  formatPaginatedResponse,
  getPaginationParams,
} from '../../utils/pagination.util';
import type {
  CreateEventInput,
  EventFilters,
  EventResponse,
  PopulatedOrganizer,
  TranslationFields,
  UpdateEventInput,
} from './events.types';

export type {
  CreateEventInput,
  EventFilters,
  EventResponse,
  TranslationFields,
  UpdateEventInput,
} from './events.types';

type EventDoc = {
  _id: mongoose.Types.ObjectId | { toString(): string };
  translations?:
    | {
        title?: { en?: string; uk?: string };
        description?: { en?: string; uk?: string };
        location?: { en?: string; uk?: string };
        speakers?: Array<{ en?: string; uk?: string }>;
        partners?: Array<{ en?: string; uk?: string; imageUrl?: string }>;
        date?: { en?: string; uk?: string };
      }
    | undefined;
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  registeredCount: number;
  isActive: boolean;
  lifecyclePhase?: IEvent['lifecyclePhase'];
  status?: IEvent['status'];
  slug?: string;
  shortDesc?: string;
  city?: string;
  venue?: string;
  dateLabel?: string;
  timeLabel?: string;
  cover?: string;
  fee?: string;
  afu?: string;
  perks?: string[];
  spots?: { taken?: number; total?: number };
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
  distances?: IEvent['distances'];
  kidsDistances?: IEvent['kidsDistances'];
  schedule?: IEvent['schedule'];
  program?: IEvent['program'];
  map?:
    | {
        latitude?: number;
        longitude?: number;
      }
    | undefined;
  createdAt: Date;
  updatedAt: Date;
  organizer?: PopulatedOrganizer | undefined;
};

function buildTranslations(event: {
  translations?: EventDoc['translations'];
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
  if (t.partners !== undefined) {
    translations.partners = t.partners;
  }
  return translations;
}

function resolveByLang(
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
    translations.speakers?.map(s => pick(s.en, s.uk)).filter((v): v is string => !!v) ?? undefined;

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

function formatEventResponse(event: EventDoc, lang?: 'en' | 'uk'): EventResponse {
  const translations = buildTranslations(event);
  const resolved = resolveByLang(translations, lang);
  const response: EventResponse = {
    id: event._id.toString(),
    translations,
    title: event.title,
    description: event.description,
    date: event.date,
    location: event.location,
    capacity: event.capacity,
    registeredCount: event.registeredCount,
    isActive: event.isActive ?? true,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
  if (resolved.title !== undefined) response.resolvedTitle = resolved.title;
  if (resolved.description !== undefined) response.resolvedDescription = resolved.description;
  if (resolved.location !== undefined) response.resolvedLocation = resolved.location;
  if (resolved.speakers !== undefined) response.resolvedSpeakers = resolved.speakers;
  if (resolved.date !== undefined) response.resolvedDate = resolved.date;
  if (event.lifecyclePhase !== undefined) response.lifecyclePhase = event.lifecyclePhase;
  if (event.status !== undefined) response.status = event.status;
  if (event.slug !== undefined) response.slug = event.slug;
  if (event.shortDesc !== undefined) response.shortDesc = event.shortDesc;
  if (event.city !== undefined) response.city = event.city;
  if (event.venue !== undefined) response.venue = event.venue;
  if (event.dateLabel !== undefined) response.dateLabel = event.dateLabel;
  if (event.timeLabel !== undefined) response.timeLabel = event.timeLabel;
  if (event.cover !== undefined) response.cover = event.cover;
  if (event.fee !== undefined) response.fee = event.fee;
  if (event.afu !== undefined) response.afu = event.afu;
  if (event.perks !== undefined) response.perks = event.perks;
  if (event.spots !== undefined) response.spots = event.spots;
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
  if (event.distances !== undefined) response.distances = event.distances;
  if (event.kidsDistances !== undefined) response.kidsDistances = event.kidsDistances;
  if (event.schedule !== undefined) response.schedule = event.schedule;
  if (event.program !== undefined) response.program = event.program;
  if (event.map !== undefined) {
    response.map = event.map;
  }
  if (event.organizer !== undefined) {
    response.organizer = event.organizer;
  }
  return response;
}

function normalizeTranslationsForWrite(input: CreateEventInput): {
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

function mergeTranslationsForUpdate(
  existing: {
    translations?: EventDoc['translations'];
    title: string;
    description: string;
    location: string;
    speakers?: Speaker[];
  },
  input: UpdateEventInput
): { updateFields: Partial<IEvent> } {
  const currentTranslations = buildTranslations(existing);

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
  if (input.translations?.partners !== undefined) {
    mergedTranslations.partners = input.translations.partners;
  } else if (currentTranslations.partners !== undefined) {
    mergedTranslations.partners = currentTranslations.partners;
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
  if (input.isActive !== undefined) updateFields.isActive = input.isActive;
  if (input.lifecyclePhase !== undefined) updateFields.lifecyclePhase = input.lifecyclePhase;
  if (input.status !== undefined) updateFields.status = input.status;
  if (input.slug !== undefined) updateFields.slug = input.slug;
  if (input.shortDesc !== undefined) updateFields.shortDesc = input.shortDesc;
  if (input.city !== undefined) updateFields.city = input.city;
  if (input.venue !== undefined) updateFields.venue = input.venue;
  if (input.dateLabel !== undefined) updateFields.dateLabel = input.dateLabel;
  if (input.timeLabel !== undefined) updateFields.timeLabel = input.timeLabel;
  if (input.cover !== undefined) updateFields.cover = input.cover;
  if (input.fee !== undefined) updateFields.fee = input.fee;
  if (input.afu !== undefined) updateFields.afu = input.afu;
  if (input.perks !== undefined) updateFields.perks = input.perks;
  if (input.spots !== undefined) updateFields.spots = input.spots;
  if (input.imageUrl !== undefined) {
    // Partial merge for imageUrl
    updateFields.imageUrl = {
      portrait: input.imageUrl.portrait ?? '',
      landscape: input.imageUrl.landscape ?? '',
    };
  }
  if (input.basePrice !== undefined) updateFields.basePrice = input.basePrice;
  if (input.gallery !== undefined) updateFields.gallery = input.gallery;
  if (input.distances !== undefined) updateFields.distances = input.distances;
  if (input.kidsDistances !== undefined) updateFields.kidsDistances = input.kidsDistances;
  if (input.schedule !== undefined) updateFields.schedule = input.schedule;
  if (input.program !== undefined) updateFields.program = input.program;
  if (input.map !== undefined) updateFields.map = input.map;

  return { updateFields };
}

/**
 * Build the MongoDB query filter for listing events.
 * Public callers always get isActive:true; admins see everything unless they
 * explicitly pass isActive in the filters.
 */
function buildListQuery(filters: EventFilters, isAdmin: boolean): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  if (filters.startDate || filters.endDate) {
    const dateRange: { $gte?: Date; $lte?: Date } = {};
    if (filters.startDate) dateRange.$gte = filters.startDate;
    if (filters.endDate) dateRange.$lte = filters.endDate;
    query.date = dateRange;
  }

  if (filters.location) {
    query.location = { $regex: filters.location, $options: 'i' };
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.lifecyclePhase) {
    query.lifecyclePhase = filters.lifecyclePhase;
  }

  if (filters.isActive !== undefined) {
    // Explicit filter wins for both public and admin
    query.isActive = filters.isActive;
  } else if (!isAdmin) {
    // Public callers default to active-only
    query.isActive = true;
  }
  // Admin without explicit isActive → no isActive constraint → sees everything

  return query;
}

export async function getEvents(
  filters: EventFilters,
  page?: number,
  limit?: number,
  lang?: 'en' | 'uk',
  isAdmin = false
): Promise<PaginatedResponse<EventResponse>> {
  const { page: parsedPage, limit: parsedLimit, skip } = getPaginationParams(page, limit);

  const query = buildListQuery(filters, isAdmin);

  const total = await Event.countDocuments(query);

  const events = await Event.find(query)
    .populate('organizer', 'name email image')
    .sort({ date: 1 })
    .skip(skip)
    .limit(parsedLimit)
    .lean();

  const eventResponses = events.map((event: EventDoc) => formatEventResponse(event, lang));

  return formatPaginatedResponse(eventResponses, total, parsedPage, parsedLimit);
}

export async function getSingleEvent(lang?: 'en' | 'uk'): Promise<EventResponse> {
  let event: EventDoc | null = null;

  if (eventConfig.singleEventId && mongoose.Types.ObjectId.isValid(eventConfig.singleEventId)) {
    event = await Event.findById(eventConfig.singleEventId).lean();
  }

  if (!event) {
    event = await Event.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
  }

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  return formatEventResponse(event, lang);
}

export async function getEventById(
  id: string,
  lang?: 'en' | 'uk',
  isAdmin = false
): Promise<EventResponse> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('Invalid event ID');
  }

  const query: Record<string, unknown> = { _id: id };
  if (!isAdmin) {
    query.isActive = true;
  }

  const event = await Event.findOne(query).populate('organizer', 'name email image').lean();

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  return formatEventResponse(event as EventDoc, lang);
}

export async function createEvent(
  userId: string,
  input: CreateEventInput,
  isAdmin = false
): Promise<EventResponse> {
  if (!isAdmin && new Date(input.date) <= new Date()) {
    throw new ConflictError('Event date must be in the future');
  }

  const normalized = normalizeTranslationsForWrite(input);

  const event = await Event.create({
    translations: normalized.translations,
    title: normalized.legacyTitle,
    description: normalized.legacyDescription,
    location: normalized.legacyLocation,
    speakers: normalized.speakers,
    date: input.date,
    capacity: input.capacity,
    isActive: input.isActive ?? true,
    lifecyclePhase: input.lifecyclePhase,
    status: input.status,
    slug: input.slug,
    shortDesc: input.shortDesc,
    city: input.city,
    venue: input.venue,
    dateLabel: input.dateLabel,
    timeLabel: input.timeLabel,
    cover: input.cover,
    fee: input.fee,
    afu: input.afu,
    perks: input.perks,
    spots: input.spots,
    imageUrl: input.imageUrl,
    basePrice: input.basePrice,
    gallery: input.gallery,
    distances: input.distances,
    kidsDistances: input.kidsDistances,
    schedule: input.schedule,
    program: input.program,
    map: input.map,
    organizerId: userId,
    registeredCount: 0,
  });

  await event.populate('organizer', 'name email image');

  return formatEventResponse(event.toObject() as EventDoc);
}

export async function updateEvent(
  id: string,
  userId: string,
  input: UpdateEventInput,
  isAdmin = false
): Promise<EventResponse> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('Invalid event ID');
  }

  const existing = await Event.findById(id).lean();

  if (!existing) {
    throw new NotFoundError('Event not found');
  }

  if (!isAdmin && existing.organizerId?.toString() !== userId) {
    throw new ForbiddenError('You are not authorized to update this event');
  }

  if (!isAdmin && input.date && new Date(input.date) <= new Date()) {
    throw new ConflictError('Event date must be in the future');
  }

  const merged = mergeTranslationsForUpdate(existing, input);

  // Use $set so Mongoose only validates the fields being changed.
  // This avoids required-field errors on pre-existing documents that have
  // missing/null fields (e.g. organizerId) we are not touching.
  const updated = await Event.findByIdAndUpdate(
    id,
    { $set: merged.updateFields },
    { new: true, runValidators: false }
  )
    .populate('organizer', 'name email image')
    .lean();

  if (!updated) {
    throw new NotFoundError('Event not found');
  }

  return formatEventResponse(updated as EventDoc);
}

export async function deleteEvent(id: string, userId: string, isAdmin = false): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError('Invalid event ID');
  }

  const event = await Event.findById(id);

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (!isAdmin && event.organizerId.toString() !== userId) {
    throw new ForbiddenError('You are not authorized to delete this event');
  }

  const confirmedRegistrations = await Registration.countDocuments({
    eventId: id,
    status: 'confirmed',
  });

  if (confirmedRegistrations > 0) {
    throw new ConflictError('Cannot delete event with confirmed registrations');
  }

  await Event.deleteOne({ _id: id });
}

export async function getMyEvents(
  userId: string,
  page?: number,
  limit?: number
): Promise<PaginatedResponse<EventResponse>> {
  const { page: parsedPage, limit: parsedLimit, skip } = getPaginationParams(page, limit);

  const query = { organizerId: userId };

  const total = await Event.countDocuments(query);

  const events = await Event.find(query)
    .populate('organizer', 'name email image')
    .sort({ date: 1 })
    .skip(skip)
    .limit(parsedLimit)
    .lean();

  const eventResponses = events.map((event: EventDoc) => formatEventResponse(event));

  return formatPaginatedResponse(eventResponses, total, parsedPage, parsedLimit);
}

export async function checkUserRegistration(
  eventId: string,
  userId: string
): Promise<{ isRegistered: boolean }> {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throw new NotFoundError('Invalid event ID');
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const registration = await Registration.findOne({
    eventId,
    userId,
    status: 'confirmed',
  });

  return {
    isRegistered: !!registration,
  };
}

export default {
  getEvents,
  getSingleEvent,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getMyEvents,
  checkUserRegistration,
};
