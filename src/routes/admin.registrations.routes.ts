import { Router } from 'express';
import {
  cancelAdminRegistration,
  exportAdminRegistrations,
  getAdminRegistration,
  listAdminRegistrations,
} from '../controllers/adminRegistrations.controller';
import { requireAdmin } from '../middleware/admin.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  adminRegistrationExportQuerySchema,
  adminRegistrationIdParamSchema,
  adminRegistrationListQuerySchema,
} from '../validators/adminRegistrations.validator';

const router = Router();

router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/admin/registrations:
 *   get:
 *     summary: List all registrations across all events (admin)
 *     tags: [AdminRegistrations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches name, surname, email, or phone
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, confirmed, cancelled] }
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string, enum: [pending, completed, failed, refunded] }
 *       - in: query
 *         name: eventId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated list of registrations }
 */
router.get(
  '/',
  validate(adminRegistrationListQuerySchema, ValidationType.QUERY, { statusCode: 422 }),
  asyncHandler(listAdminRegistrations)
);

/**
 * @swagger
 * /api/admin/registrations/export:
 *   get:
 *     summary: Export the filtered registration list as CSV (admin)
 *     tags: [AdminRegistrations]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: CSV file }
 */
router.get(
  '/export',
  validate(adminRegistrationExportQuerySchema, ValidationType.QUERY, { statusCode: 422 }),
  asyncHandler(exportAdminRegistrations)
);

/**
 * @swagger
 * /api/admin/registrations/{id}:
 *   get:
 *     summary: Get a single registration with payments and linked user (admin)
 *     tags: [AdminRegistrations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Registration detail }
 *       404: { description: Registration not found }
 */
router.get(
  '/:id',
  validate(adminRegistrationIdParamSchema, ValidationType.PARAMS, { statusCode: 422 }),
  asyncHandler(getAdminRegistration)
);

/**
 * @swagger
 * /api/admin/registrations/{id}/cancel:
 *   post:
 *     summary: Cancel a registration and refund/cancel its payments (admin)
 *     tags: [AdminRegistrations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Registration cancelled }
 *       404: { description: Registration not found }
 *       409: { description: Registration already cancelled }
 */
router.post(
  '/:id/cancel',
  validate(adminRegistrationIdParamSchema, ValidationType.PARAMS, { statusCode: 422 }),
  asyncHandler(cancelAdminRegistration)
);

export default router;
