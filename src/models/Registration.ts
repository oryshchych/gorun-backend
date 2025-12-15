import mongoose, { Document, Schema } from 'mongoose';

export interface IRegistration extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  name?: string;
  surname?: string;
  email?: string;
  city?: string;
  runningClub?: string;
  phone?: string;
  promoCode?: string;
  promoCodeId?: mongoose.Types.ObjectId;
  status: 'pending' | 'confirmed' | 'cancelled';
  registeredAt: Date;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentId?: string;
  finalPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

const phoneRegex = /^\+?[\d\s-()]+$/;

const registrationSchema = new Schema<IRegistration>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    name: {
      type: String,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must not exceed 50 characters'],
      trim: true,
    },
    surname: {
      type: String,
      minlength: [2, 'Surname must be at least 2 characters'],
      maxlength: [50, 'Surname must not exceed 50 characters'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator(value: string) {
          if (!value) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'Please enter a valid email address (e.g., user@example.com)',
      },
    },
    city: {
      type: String,
      minlength: [2, 'City must be at least 2 characters'],
      maxlength: [100, 'City must not exceed 100 characters'],
      trim: true,
    },
    runningClub: {
      type: String,
      maxlength: [100, 'Running club must not exceed 100 characters'],
      trim: true,
    },
    phone: {
      type: String,
      maxlength: [20, 'Phone must not exceed 20 characters'],
      trim: true,
      validate: {
        validator(value: string) {
          if (!value) return true;
          return phoneRegex.test(value);
        },
        message: 'Phone must contain only numbers, spaces, +, -, or parentheses',
      },
    },
    promoCode: {
      type: String,
      uppercase: true,
      maxlength: [50, 'Promo code must not exceed 50 characters'],
      trim: true,
    },
    promoCodeId: {
      type: Schema.Types.ObjectId,
      ref: 'PromoCode',
      required: false,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    paymentId: {
      type: String,
    },
    finalPrice: {
      type: Number,
      min: [0, 'Final price cannot be negative'],
    },
  },
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
registrationSchema.index(
  { eventId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } }
);
registrationSchema.index(
  { eventId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $exists: true } } }
);
registrationSchema.index({ eventId: 1 });
registrationSchema.index({ userId: 1 });
registrationSchema.index({ status: 1 });
registrationSchema.index({ paymentStatus: 1 });
registrationSchema.index({ promoCodeId: 1 });

// Virtual for event population
registrationSchema.virtual('event', {
  ref: 'Event',
  localField: 'eventId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for user population
registrationSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

export const Registration = mongoose.model<IRegistration>('Registration', registrationSchema);
