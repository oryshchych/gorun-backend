import bcrypt from 'bcrypt';
import mongoose, { Document, Schema } from 'mongoose';

export const USER_GENDER_VALUES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
export type UserGender = (typeof USER_GENDER_VALUES)[number];

export const USER_ADMIN_ROLES = ['admin', 'super_admin'] as const;
export type UserAdminRole = (typeof USER_ADMIN_ROLES)[number];

export interface KidProfile {
  id?: string;
  name: string;
  age?: number;
  shirtSize?: string;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email: string;
  password: string;
  image?: string;
  provider: 'credentials' | 'google';
  providerId?: string;
  /** ISO date-only YYYY-MM-DD */
  dateOfBirth?: string;
  gender?: UserGender;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  runningClub?: string;
  city?: string;
  deliveryAddress?: string;
  isAdmin: boolean;
  adminRole?: UserAdminRole;
  kids?: KidProfile[];
  /** Soft-delete marker. Null/absent means the account is active. */
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
      trim: true,
    },
    firstName: {
      type: String,
      maxlength: [100, 'First name must not exceed 100 characters'],
      trim: true,
    },
    lastName: {
      type: String,
      maxlength: [100, 'Last name must not exceed 100 characters'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      match: [/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      maxlength: [100, 'Password must not exceed 100 characters'],
    },
    image: {
      type: String,
      default: undefined,
    },
    provider: {
      type: String,
      enum: ['credentials', 'google'],
      default: 'credentials',
    },
    providerId: {
      type: String,
      // No default - field is omitted when not provided
    },
    dateOfBirth: {
      type: String,
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD'],
    },
    gender: {
      type: String,
      enum: USER_GENDER_VALUES,
    },
    emergencyContactName: {
      type: String,
      maxlength: [200, 'Emergency contact name must not exceed 200 characters'],
      trim: true,
    },
    emergencyContactPhone: {
      type: String,
      trim: true,
      match: [/^\+[1-9]\d{6,14}$/, 'Emergency phone must be in E.164 format'],
    },
    runningClub: {
      type: String,
      maxlength: [200, 'Running club must not exceed 200 characters'],
      trim: true,
    },
    city: {
      type: String,
      maxlength: [100, 'City must not exceed 100 characters'],
      trim: true,
    },
    deliveryAddress: {
      type: String,
      maxlength: [2000, 'Delivery address must not exceed 2000 characters'],
      trim: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    adminRole: {
      type: String,
      enum: USER_ADMIN_ROLES,
    },
    kids: {
      type: [
        {
          id: { type: String },
          name: { type: String, required: true, trim: true, maxlength: 100 },
          age: { type: Number, min: 0, max: 17 },
          shirtSize: { type: String, trim: true },
        },
      ],
      default: undefined,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const transformed = ret as Record<string, unknown>;
        delete transformed.password;
        transformed.id = (ret._id as mongoose.Types.ObjectId).toString();
        delete transformed._id;
        delete transformed.__v;
        return transformed;
      },
    },
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
// Sparse index to speed up filtering out soft-deleted accounts
userSchema.index({ deletedAt: 1 }, { sparse: true });
// Partial index: only index documents where providerId exists and is not null
// This prevents duplicate key errors for credentials users (who don't have providerId)
userSchema.index(
  { provider: 1, providerId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerId: { $exists: true, $ne: null } },
  }
);

// Instance method to compare password
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Pre-save hook to remove providerId for credentials users
// This ensures the field is truly omitted (not null) to work with partial index
userSchema.pre('save', function (next) {
  if (this.provider === 'credentials') {
    // Use $unset to ensure the field is truly omitted from the document
    // This prevents MongoDB from storing null, which would violate the partial unique index
    if (this.providerId === null || this.providerId === undefined) {
      const doc = this as unknown as {
        $unset?: Record<string, string>;
        _doc?: Record<string, unknown>;
      };
      doc.$unset = doc.$unset || {};
      doc.$unset.providerId = '';
      // Also remove from _doc to ensure it's not in the document
      if (doc._doc && 'providerId' in doc._doc) {
        delete doc._doc.providerId;
      }
    }
  }
  next();
});

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Derive display name from first + last when both set
userSchema.pre('save', function (next) {
  if (this.firstName && this.lastName) {
    const combined = `${this.firstName} ${this.lastName}`.trim();
    if (combined.length >= 2) {
      this.name = combined;
    }
  }
  next();
});

// Admin flag / role consistency: non-admins have no role; admins default to 'admin' if role missing
userSchema.pre('save', function (next) {
  if (!this.isAdmin) {
    this.set('adminRole', undefined);
  } else if (!this.adminRole) {
    this.adminRole = 'admin';
  }
  next();
});

export const User = mongoose.model<IUser>('User', userSchema);
