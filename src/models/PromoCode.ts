import mongoose, { Document, Schema } from 'mongoose';

export interface IPromoCode extends Document {
  _id: mongoose.Types.ObjectId;
  code: string;
  discountType: 'percentage' | 'amount';
  discountValue: number;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  expirationDate?: Date;
  eventId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const promoCodeSchema = new Schema<IPromoCode>(
  {
    code: {
      type: String,
      required: [true, 'Promo code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [50, 'Promo code must not exceed 50 characters'],
    },
    discountType: {
      type: String,
      enum: ['percentage', 'amount'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value must be greater than 0'],
    },
    usageLimit: {
      type: Number,
      required: [true, 'Usage limit is required'],
      min: [1, 'Usage limit must be at least 1'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expirationDate: {
      type: Date,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: false,
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

promoCodeSchema.index({ code: 1 }, { unique: true });
promoCodeSchema.index({ isActive: 1 });
promoCodeSchema.index({ eventId: 1 });

export const PromoCode = mongoose.model<IPromoCode>('PromoCode', promoCodeSchema);
