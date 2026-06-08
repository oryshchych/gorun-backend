import { AuditAction, AuditActorRole, AuditChange, AuditEntity } from '../../models/AuditLog';

export interface AuditLogItem {
  id: string;
  actorId: string | undefined;
  actorName: string;
  actorEmail: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  changes: AuditChange[];
  ip: string | undefined;
  userAgent: string | undefined;
  createdAt: Date;
}

export interface GetAuditLogsInput {
  entity?: AuditEntity;
  action?: AuditAction;
  actorId?: string;
  actorEmail?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
}
