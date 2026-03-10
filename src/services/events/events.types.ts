import mongoose from 'mongoose';
import { Speaker } from '../../models/Event';

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
