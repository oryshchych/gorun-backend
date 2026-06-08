import { FilterQuery } from 'mongoose';
import { AuditLog, IAuditLog } from '../../models/AuditLog';
import {
  formatPaginatedResponse,
  getPaginationParams,
  PaginatedResponse,
} from '../../utils/pagination.util';
import { AuditLogItem, GetAuditLogsInput } from './adminAuditLogs.types';

function formatAuditLog(doc: IAuditLog): AuditLogItem {
  return {
    id: doc._id.toString(),
    actorId: doc.actorId?.toString(),
    actorName: doc.actorName,
    actorEmail: doc.actorEmail,
    actorRole: doc.actorRole,
    action: doc.action,
    entity: doc.entity,
    entityId: doc.entityId,
    entityLabel: doc.entityLabel,
    changes: doc.changes,
    ip: doc.ip,
    userAgent: doc.userAgent,
    createdAt: doc.createdAt,
  };
}

export async function getAuditLogs(
  input: GetAuditLogsInput
): Promise<PaginatedResponse<AuditLogItem>> {
  const { page, limit, skip } = getPaginationParams(input.page, input.limit);

  const query: FilterQuery<IAuditLog> = {};

  if (input.entity) query.entity = input.entity;
  if (input.action) query.action = input.action;
  if (input.actorId) query.actorId = input.actorId;
  if (input.actorEmail) query.actorEmail = { $regex: input.actorEmail, $options: 'i' };

  if (input.dateFrom ?? input.dateTo) {
    query.createdAt = {};
    if (input.dateFrom) query.createdAt.$gte = input.dateFrom;
    if (input.dateTo) query.createdAt.$lte = input.dateTo;
  }

  const [total, docs] = await Promise.all([
    AuditLog.countDocuments(query),
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<IAuditLog[]>(),
  ]);

  return formatPaginatedResponse(docs.map(formatAuditLog), total, page, limit);
}
