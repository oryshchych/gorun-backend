import mongoose, { Document, Schema } from 'mongoose';

export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'CANCEL'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITIES = ['Event', 'Registration', 'User', 'PromoCode'] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ACTOR_ROLES = ['user', 'admin', 'super_admin'] as const;
export type AuditActorRole = (typeof AUDIT_ACTOR_ROLES)[number];

export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId;
  actorName: string;
  actorEmail: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  changes: AuditChange[];
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditChangeSchema = new Schema<AuditChange>(
  {
    field: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: { type: String, required: true },
    actorEmail: { type: String, required: true },
    actorRole: { type: String, enum: AUDIT_ACTOR_ROLES, required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    entity: { type: String, enum: AUDIT_ENTITIES, required: true, index: true },
    entityId: { type: String, required: true },
    entityLabel: { type: String, required: true },
    changes: { type: [auditChangeSchema], default: [] },
    ip: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ createdAt: -1 });

auditLogSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    r.id = (r._id as mongoose.Types.ObjectId).toString();
    delete r._id;
    delete r.__v;
    return r;
  },
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
