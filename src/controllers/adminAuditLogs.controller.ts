import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { getAuditLogs } from '../services/adminAuditLogs/adminAuditLogs.service';
import type { GetAuditLogsInput } from '../services/adminAuditLogs/adminAuditLogs.types';
import { AUDIT_LOGS_CODES } from '../types/codes';

export const listAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  const { entity, action, actorId, actorEmail, dateFrom, dateTo, page, limit } =
    req.validatedQuery as {
      entity?: string;
      action?: string;
      actorId?: string;
      actorEmail?: string;
      dateFrom?: string;
      dateTo?: string;
      page: number;
      limit: number;
    };

  const input: GetAuditLogsInput = { page, limit };
  if (entity) input.entity = entity as Exclude<GetAuditLogsInput['entity'], undefined>;
  if (action) input.action = action as Exclude<GetAuditLogsInput['action'], undefined>;
  if (actorId) input.actorId = actorId;
  if (actorEmail) input.actorEmail = actorEmail;
  if (dateFrom) input.dateFrom = new Date(dateFrom);
  if (dateTo) input.dateTo = new Date(dateTo);

  const result = await getAuditLogs(input);

  res.status(200).json({
    success: true,
    code: AUDIT_LOGS_CODES.SUCCESS_AUDIT_LOGS_RETRIEVED,
    data: result.data,
    pagination: result.pagination,
  });
};
