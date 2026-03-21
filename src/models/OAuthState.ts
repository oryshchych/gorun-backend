import mongoose, { Document, Schema } from 'mongoose';

export interface IOAuthState extends Document {
  _id: mongoose.Types.ObjectId;
  state: string;
  /** Full frontend URL to redirect to after OAuth (origin must be allowlisted) */
  redirectUri: string;
  locale?: string;
  rememberMe: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const oauthStateSchema = new Schema<IOAuthState>(
  {
    state: {
      type: String,
      required: true,
      unique: true,
    },
    redirectUri: {
      type: String,
      required: true,
      maxlength: 2048,
    },
    locale: {
      type: String,
      maxlength: 10,
    },
    rememberMe: {
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

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthState = mongoose.model<IOAuthState>('OAuthState', oauthStateSchema);
