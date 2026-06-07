import { Router } from 'express';
import {
  cancelUserRegistration,
  deleteAdminUser,
  exportAdminUsers,
  getAdminUser,
  listAdminUsers,
  updateAdminUser,
} from '../controllers/adminUsers.controller';
import { requireAdmin } from '../middleware/admin.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  adminUserExportQuerySchema,
  adminUserIdParamSchema,
  adminUserListQuerySchema,
  adminUserRegistrationParamSchema,
  adminUserUpdateBodySchema,
} from '../validators/adminUsers.validator';

const router = Router();

router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List users (admin)
 *     tags: [AdminUsers]
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
 *         description: Matches first name, last name, phone, or email
 *       - in: query
 *         name: source
 *         schema: { type: string, enum: [all, registered, app_only] }
 *     responses:
 *       200: { description: Paginated list of users }
 */
router.get(
  '/',
  validate(adminUserListQuerySchema, ValidationType.QUERY, { statusCode: 422 }),
  asyncHandler(listAdminUsers)
);

/**
 * @swagger
 * /api/admin/users/export:
 *   get:
 *     summary: Export the filtered user list as CSV (admin)
 *     tags: [AdminUsers]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: CSV file }
 */
router.get(
  '/export',
  validate(adminUserExportQuerySchema, ValidationType.QUERY, { statusCode: 422 }),
  asyncHandler(exportAdminUsers)
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a user with registrations and payments (admin)
 *     tags: [AdminUsers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User detail }
 *       404: { description: User not found }
 */
router.get(
  '/:id',
  validate(adminUserIdParamSchema, ValidationType.PARAMS, { statusCode: 422 }),
  asyncHandler(getAdminUser)
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     summary: Update a user's profile/contact fields (admin)
 *     tags: [AdminUsers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated user detail }
 *       409: { description: Email or phone already in use }
 */
router.patch(
  '/:id',
  validate(adminUserIdParamSchema, ValidationType.PARAMS, { statusCode: 422 }),
  validate(adminUserUpdateBodySchema, ValidationType.BODY, { statusCode: 422 }),
  asyncHandler(updateAdminUser)
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Soft-delete (deactivate) a user (admin)
 *     tags: [AdminUsers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User deactivated }
 *       403: { description: Cannot deactivate self or last super admin }
 */
router.delete(
  '/:id',
  validate(adminUserIdParamSchema, ValidationType.PARAMS, { statusCode: 422 }),
  asyncHandler(deleteAdminUser)
);

/**
 * @swagger
 * /api/admin/users/{id}/registrations/{registrationId}/cancel:
 *   post:
 *     summary: Cancel one of a user's registrations and refund/cancel its payments (admin)
 *     tags: [AdminUsers]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Registration cancelled }
 *       404: { description: Registration not found }
 *       409: { description: Registration already cancelled }
 */
router.post(
  '/:id/registrations/:registrationId/cancel',
  validate(adminUserRegistrationParamSchema, ValidationType.PARAMS, { statusCode: 422 }),
  asyncHandler(cancelUserRegistration)
);

export default router;
