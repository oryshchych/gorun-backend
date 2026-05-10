import mongoose from 'mongoose';
import type {
  Distance,
  EventLifecyclePhase,
  EventStatus,
  KidsDistance,
  ScheduleItem,
  Speaker,
  Spots,
} from '../../models/Event';

export type { EventLifecyclePhase, EventStatus } from '../../models/Event';

export type TranslationFields = {
  title?: { en?: string; uk?: string };
  description?: { en?: string; uk?: string };
  location?: { en?: string; uk?: string };
  speakers?: Array<{ en?: string; uk?: string }>;
  date?: { en?: string; uk?: string };
  partners?: Array<{ en?: string; uk?: string; imageUrl?: string }>;
};

export interface CreateEventInput {
  translations: TranslationFields;
  title?: string;
  description?: string;
  date: Date;
  location?: string;
  capacity: number;
  isActive?: boolean;
  lifecyclePhase?: EventLifecyclePhase;
  status?: EventStatus;
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
  spots?: Spots;
  imageUrl?: {
    portrait: string;
    landscape: string;
  };
  basePrice?: number;
  speakers?: Speaker[];
  gallery?: string[];
  distances?: Distance[];
  kidsDistances?: KidsDistance[];
  schedule?: ScheduleItem[];
  program?: ScheduleItem[];
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
  isActive?: boolean;
  lifecyclePhase?: EventLifecyclePhase;
  status?: EventStatus;
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
  spots?: Spots;
  imageUrl?: {
    portrait?: string;
    landscape?: string;
  };
  basePrice?: number;
  speakers?: Speaker[];
  gallery?: string[];
  distances?: Distance[];
  kidsDistances?: KidsDistance[];
  schedule?: ScheduleItem[];
  program?: ScheduleItem[];
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
  status?: EventStatus;
  lifecyclePhase?: EventLifecyclePhase;
  isActive?: boolean;
}

export interface PopulatedOrganizer {
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
  isActive: boolean;
  lifecyclePhase?: EventLifecyclePhase;
  status?: EventStatus;
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
  spots?: Spots;
  organizerId?: string;
  imageUrl?: {
    portrait: string;
    landscape: string;
  };
  basePrice?: number;
  speakers?: Speaker[];
  gallery?: string[];
  distances?: Distance[];
  kidsDistances?: KidsDistance[];
  schedule?: ScheduleItem[];
  program?: ScheduleItem[];
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
