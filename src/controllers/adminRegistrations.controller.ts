import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Registration } from '../models/Registration';
import adminRegistrationsService from '../services/adminRegistrations/adminRegistrations.service';
import type {
  AdminRegistrationExportQuery,
  AdminRegistrationListQuery,
} from '../services/adminRegistrations/adminRegistrations.types';
import { ADMIN_REGISTRATIONS_CODES } from '../types/codes';
import { writeAuditLog } from '../utils/audit.util';

export const listAdminRegistrations = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = req.validatedQuery as AdminRegistrationListQuery;
  const result = await adminRegistrationsService.listAdminRegistrations(q);

  res.status(200).json({
    success: true,
    code: ADMIN_REGISTRATIONS_CODES.SUCCESS_ADMIN_REGISTRATIONS_LIST_RETRIEVED,
    data: result.data,
    pagination: result.pagination,
  });
};

export const exportAdminRegistrations = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = req.validatedQuery as AdminRegistrationExportQuery;
  const csv = await adminRegistrationsService.exportAdminRegistrationsCsv(q);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
  res.status(200).send(csv);
};

export const getAdminRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const data = await adminRegistrationsService.getAdminRegistrationById(id);

  res.status(200).json({
    success: true,
    code: ADMIN_REGISTRATIONS_CODES.SUCCESS_ADMIN_REGISTRATION_RETRIEVED,
    data,
  });
};

export const cancelAdminRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };

  const before = await Registration.findById(id).lean();
  const data = await adminRegistrationsService.cancelAdminRegistration(id);
  const after = await Registration.findById(id).lean();

  void writeAuditLog({
    req,
    action: 'CANCEL',
    entity: 'Registration',
    entityId: id,
    entityLabel:
      (before as { email?: string; name?: string } | null)?.email ??
      (before as { name?: string } | null)?.name ??
      id,
    before: (before ?? {}) as Record<string, unknown>,
    after: (after ?? {}) as Record<string, unknown>,
  });

  res.status(200).json({
    success: true,
    code: ADMIN_REGISTRATIONS_CODES.SUCCESS_ADMIN_REGISTRATION_CANCELLED,
    data,
  });
};
