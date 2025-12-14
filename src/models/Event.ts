import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
  registeredCount: number;
  organizerId: mongoose.Types.ObjectId;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  hasAvailableCapacity(): boolean;
}

const eventSchema = new Schema<IEvent>(
  {
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
      validate: {
        validator(value: Date) {
          return value > new Date();
        },
        message: 'Event date must be in the future',
      },
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
    imageUrl: {
      type: String,
      default: undefined,
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
        message: 'Image URL must be a valid URL',
      },
    },
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
