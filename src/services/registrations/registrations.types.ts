import mongoose from 'mongoose';

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

export interface PopulatedUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  image?: string;
}

export interface PopulatedEvent {
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
