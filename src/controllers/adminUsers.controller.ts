import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import adminUsersService from '../services/adminUsers/adminUsers.service';
import type {
  AdminUserExportQuery,
  AdminUserListQuery,
  UpdateAdminUserInput,
} from '../services/adminUsers/adminUsers.types';
import { ADMIN_USERS_CODES } from '../types/codes';

export const listAdminUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = req.validatedQuery as AdminUserListQuery;
  const result = await adminUsersService.listAdminUsers(q);

  res.status(200).json({
    success: true,
    code: ADMIN_USERS_CODES.SUCCESS_ADMIN_USERS_LIST_RETRIEVED,
    data: result.data,
    pagination: result.pagination,
  });
};

export const exportAdminUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = req.validatedQuery as AdminUserExportQuery;
  const csv = await adminUsersService.exportAdminUsersCsv(q);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
  res.status(200).send(csv);
};

export const getAdminUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const data = await adminUsersService.getAdminUserById(id);

  res.status(200).json({
    success: true,
    code: ADMIN_USERS_CODES.SUCCESS_ADMIN_USER_RETRIEVED,
    data,
  });
};

export const updateAdminUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const body = req.body as UpdateAdminUserInput;
  const data = await adminUsersService.updateAdminUser(id, body);

  res.status(200).json({
    success: true,
    code: ADMIN_USERS_CODES.SUCCESS_ADMIN_USER_UPDATED,
    data,
  });
};

export const deleteAdminUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.validatedParams as { id: string };
  const data = await adminUsersService.softDeleteUser(id, req.user!.userId);

  res.status(200).json({
    success: true,
    code: ADMIN_USERS_CODES.SUCCESS_ADMIN_USER_DELETED,
    data,
  });
};

export const cancelUserRegistration = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, registrationId } = req.validatedParams as { id: string; registrationId: string };
  const data = await adminUsersService.cancelRegistration(id, registrationId, req.user!.userId);

  res.status(200).json({
    success: true,
    code: ADMIN_USERS_CODES.SUCCESS_ADMIN_USER_REGISTRATION_CANCELLED,
    data,
  });
};
