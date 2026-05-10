import mongoose, { Document, Schema } from 'mongoose';

export interface IResult extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  registrationId?: mongoose.Types.ObjectId;
  bib?: string;
  name?: string;
  city?: string;
  /** Denormalized distance label, e.g. "21K" */
  distance?: string;
  /** Finish time as "H:MM:SS" or "MM:SS" */
  finishTime?: string;
  /** Pace per km as "M:SS" */
  paceMinKm?: string;
  /** Overall finish position */
  position?: number;
  positionGender?: number;
  positionAge?: number;
  createdAt: Date;
  updatedAt: Date;
}

const resultSchema = new Schema<IResult>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true,
    },
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: 'Registration',
    },
    bib: { type: String, trim: true },
    name: { type: String, trim: true },
    city: { type: String, trim: true },
    distance: { type: String, trim: true },
    finishTime: { type: String, trim: true },
    paceMinKm: { type: String, trim: true },
    position: { type: Number },
    positionGender: { type: Number },
    positionAge: { type: Number },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        const r = ret as Record<string, unknown>;
        r.id = (ret._id as mongoose.Types.ObjectId).toString();
        delete r._id;
        delete r.__v;
        return r;
      },
    },
    toObject: { virtuals: true },
  }
);

resultSchema.index({ eventId: 1, position: 1 });

export const Result = mongoose.model<IResult>('Result', resultSchema);
