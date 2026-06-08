import { Router } from 'express';
import { listAuditLogs } from '../controllers/adminAuditLogs.controller';
import { requireAdmin, requireSuperAdmin } from '../middleware/admin.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { listAuditLogsSchema } from '../validators/adminAuditLogs.validator';

const router = Router();

router.use(authenticate, requireAdmin, requireSuperAdmin);

router.get(
  '/',
  validate(listAuditLogsSchema, ValidationType.QUERY, { statusCode: 422 }),
  asyncHandler(listAuditLogs)
);

export default router;
