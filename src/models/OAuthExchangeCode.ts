import mongoose, { Document, Schema } from 'mongoose';

export interface IOAuthExchangeCode extends Document {
  _id: mongoose.Types.ObjectId;
  /** sha256 hex of one-time code */
  codeHash: string;
  userId: mongoose.Types.ObjectId;
  longLived: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const oauthExchangeCodeSchema = new Schema<IOAuthExchangeCode>(
  {
    codeHash: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    longLived: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

oauthExchangeCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthExchangeCode = mongoose.model<IOAuthExchangeCode>(
  'OAuthExchangeCode',
  oauthExchangeCodeSchema
);
