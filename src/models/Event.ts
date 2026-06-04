import mongoose, { Document, Schema } from 'mongoose';

export const EVENT_STATUS_VALUES = ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'] as const;
export type EventStatus = (typeof EVENT_STATUS_VALUES)[number];

export const EVENT_LIFECYCLE_PHASE_VALUES = ['PLANNED', 'FUTURE', 'CURRENT', 'FINISHED'] as const;
export type EventLifecyclePhase = (typeof EVENT_LIFECYCLE_PHASE_VALUES)[number];

export interface TranslationField {
  en?: string;
  uk?: string;
}

export interface SpeakerTranslations {
  fullname?: TranslationField;
  shortDescription?: TranslationField;
  description?: TranslationField;
}

export interface Speaker {
  id?: string;
  translations?: SpeakerTranslations;
  fullname: string;
  shortDescription: string;
  description: string;
  image: string;
  instagramLink: string;
}

export interface DistanceSpots {
  taken?: number;
  total?: number;
}

export interface Distance {
  id?: string;
  label?: string;
  name?: string;
  km?: number;
  feeUah?: number;
  /** Human-readable elevation gain, e.g. "+420m" */
  elevation?: string;
  laps?: number | null;
  spots?: DistanceSpots;
}

export interface KidsDistance {
  id?: string;
  label?: string;
  name?: string;
  age?: string;
  feeUah?: number;
}

export interface ScheduleItem {
  time: string;
  what: string;
}

export interface Spots {
  taken?: number;
  total?: number;
}

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  translations?: {
    title?: { en?: string; uk?: string };
    description?: { en?: string; uk?: string };
    location?: { en?: string; uk?: string };
    speakers?: Array<{ en?: string; uk?: string }>;
    date?: { en?: string; uk?: string };
    partners?: Array<{ en?: string; uk?: string; imageUrl?: string }>;
    /** Post-race recap shown on finished events; resolves to `resolvedPastDescription` when ?lang= is sent. */
    pastDescription?: { en?: string; uk?: string };
  };
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  registeredCount: number;
  organizerId: mongoose.Types.ObjectId;
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
  registrationStart?: Date;
  registrationEnd?: Date;
  socials?: {
    instagram?: string;
    facebook?: string;
    telegram?: string;
  };
  regulationUrl?: string;
  scheduleText?: string;
  createdAt: Date;
  updatedAt: Date;
  hasAvailableCapacity(): boolean;
}

const eventSchema = new Schema<IEvent>(
  {
    translations: {
      type: {
        title: {
          en: { type: String, trim: true },
          uk: { type: String, trim: true },
        },
        description: {
          en: { type: String, trim: true },
          uk: { type: String, trim: true },
        },
        location: {
          en: { type: String, trim: true },
          uk: { type: String, trim: true },
        },
        speakers: [
          {
            en: { type: String, trim: true },
            uk: { type: String, trim: true },
          },
        ],
        date: {
          en: { type: String, trim: true },
          uk: { type: String, trim: true },
        },
        partners: [
          {
            en: { type: String, trim: true },
            uk: { type: String, trim: true },
            imageUrl: {
              type: String,
              validate: {
                validator(value: string) {
                  if (!value) return true;
                  try {
                    new URL(value);
                    return true;
                  } catch {
                    return false;
                  }
                },
                message: 'Partner image URL must be a valid URL',
              },
            },
          },
        ],
        pastDescription: {
          en: { type: String, trim: true },
          uk: { type: String, trim: true },
        },
      },
      default: undefined,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title must not exceed 100 characters'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description must not exceed 2000 characters'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      minlength: [3, 'Location must be at least 3 characters'],
      maxlength: [200, 'Location must not exceed 200 characters'],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      max: [10000, 'Capacity must not exceed 10000'],
      validate: {
        validator: Number.isInteger,
        message: 'Capacity must be an integer',
      },
    },
    registeredCount: {
      type: Number,
      default: 0,
      min: [0, 'Registered count cannot be negative'],
    },
    organizerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer ID is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lifecyclePhase: {
      type: String,
      enum: EVENT_LIFECYCLE_PHASE_VALUES,
    },
    status: {
      type: String,
      enum: EVENT_STATUS_VALUES,
    },
    slug: {
      type: String,
      trim: true,
    },
    shortDesc: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    venue: {
      type: String,
      trim: true,
    },
    dateLabel: {
      type: String,
      trim: true,
    },
    timeLabel: {
      type: String,
      trim: true,
    },
    cover: {
      type: String,
      trim: true,
    },
    fee: {
      type: String,
      trim: true,
    },
    afu: {
      type: String,
      trim: true,
    },
    perks: {
      type: [String],
      default: undefined,
    },
    spots: {
      type: {
        taken: { type: Number, min: 0 },
        total: { type: Number, min: 0 },
      },
      default: undefined,
    },
    imageUrl: {
      type: {
        portrait: {
          type: String,
          required: true,
          validate: {
            validator(value: string) {
              if (!value) return false;
              try {
                new URL(value);
                return true;
              } catch {
                return false;
              }
            },
            message: 'Portrait image URL must be a valid URL',
          },
        },
        landscape: {
          type: String,
          required: true,
          validate: {
            validator(value: string) {
              if (!value) return false;
              try {
                new URL(value);
                return true;
              } catch {
                return false;
              }
            },
            message: 'Landscape image URL must be a valid URL',
          },
        },
      },
      default: undefined,
    },
    basePrice: {
      type: Number,
      min: [0, 'Base price cannot be negative'],
    },
    speakers: {
      type: [
        {
          id: { type: String },
          translations: {
            type: {
              fullname: {
                en: { type: String, trim: true },
                uk: { type: String, trim: true },
              },
              shortDescription: {
                en: { type: String, trim: true },
                uk: { type: String, trim: true },
              },
              description: {
                en: { type: String, trim: true },
                uk: { type: String, trim: true },
              },
            },
            default: undefined,
          },
          fullname: { type: String, required: true, trim: true },
          shortDescription: { type: String, required: true, trim: true },
          description: { type: String, required: true, trim: true },
          image: { type: String, required: true, trim: true },
          instagramLink: { type: String, required: true, trim: true },
        },
      ],
      default: [],
    },
    gallery: {
      type: [String],
      default: [],
      validate: {
        validator(values: string[]) {
          return values.every(value => {
            try {
              new URL(value);
              return true;
            } catch {
              return false;
            }
          });
        },
        message: 'Gallery items must be valid URLs',
      },
    },
    distances: {
      type: [
        {
          id: { type: String },
          label: { type: String, trim: true },
          name: { type: String, trim: true },
          km: { type: Number },
          feeUah: { type: Number },
          elevation: { type: String, trim: true },
          laps: { type: Number },
          spots: {
            type: {
              taken: { type: Number, min: 0 },
              total: { type: Number, min: 0 },
            },
            default: undefined,
          },
        },
      ],
      default: undefined,
    },
    kidsDistances: {
      type: [
        {
          id: { type: String },
          label: { type: String, trim: true },
          name: { type: String, trim: true },
          age: { type: String, trim: true },
          feeUah: { type: Number },
        },
      ],
      default: undefined,
    },
    schedule: {
      type: [
        {
          time: { type: String, required: true, trim: true },
          what: { type: String, required: true, trim: true },
        },
      ],
      default: undefined,
    },
    program: {
      type: [
        {
          time: { type: String, required: true, trim: true },
          what: { type: String, required: true, trim: true },
        },
      ],
      default: undefined,
    },
    map: {
      type: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
      default: undefined,
    },
    registrationStart: { type: Date },
    registrationEnd: { type: Date },
    socials: {
      type: {
        instagram: { type: String, trim: true },
        facebook: { type: String, trim: true },
        telegram: { type: String, trim: true },
      },
      default: undefined,
    },
    regulationUrl: { type: String, trim: true },
    scheduleText: { type: String },
  } as Record<string, unknown>,
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        const transformed = ret as Record<string, unknown>;
        transformed.id = (ret._id as mongoose.Types.ObjectId).toString();
        delete transformed._id;
        delete transformed.__v;
        return transformed;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes
eventSchema.index({ organizerId: 1 });
eventSchema.index({ date: 1 });
eventSchema.index({ location: 1 });
eventSchema.index({ isActive: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ lifecyclePhase: 1 });
eventSchema.index({ slug: 1 }, { sparse: true });
eventSchema.index({ title: 'text', description: 'text' });

// Virtual for organizer population
eventSchema.virtual('organizer', {
  ref: 'User',
  localField: 'organizerId',
  foreignField: '_id',
  justOne: true,
});

// Instance method to check available capacity
eventSchema.methods.hasAvailableCapacity = function (): boolean {
  return this.registeredCount < this.capacity;
};

export const Event = mongoose.model<IEvent>('Event', eventSchema);
