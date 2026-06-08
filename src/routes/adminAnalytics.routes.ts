import { Router } from 'express';
import {
  getAnalyticsByEvent,
  getAnalyticsDemographics,
  getAnalyticsSummary,
  getAnalyticsTimeseries,
} from '../controllers/adminAnalytics.controller';
import { requireAdmin } from '../middleware/admin.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { validate, ValidationType } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { analyticsQuerySchema } from '../validators/adminAnalytics.validator';

const router = Router();

router.use(authenticate, requireAdmin);

const validateQuery = validate(analyticsQuerySchema, ValidationType.QUERY, { statusCode: 422 });

/**
 * @swagger
 * /api/admin/analytics/summary:
 *   get:
 *     summary: KPI summary for the dashboard (admin)
 *     tags: [AdminAnalytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: preset
 *         schema: { type: string, enum: [week, month, 3months, year, custom] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: eventId
 *         schema: { type: string }
 *     responses:
 *       200: { description: KPI summary }
 */
router.get('/summary', validateQuery, asyncHandler(getAnalyticsSummary));

/**
 * @swagger
 * /api/admin/analytics/timeseries:
 *   get:
 *     summary: Day-bucketed registrations and payments series (admin)
 *     tags: [AdminAnalytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Timeseries data }
 */
router.get('/timeseries', validateQuery, asyncHandler(getAnalyticsTimeseries));

/**
 * @swagger
 * /api/admin/analytics/demographics:
 *   get:
 *     summary: Participant demographic breakdowns (admin)
 *     tags: [AdminAnalytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Demographics data }
 */
router.get('/demographics', validateQuery, asyncHandler(getAnalyticsDemographics));

/**
 * @swagger
 * /api/admin/analytics/by-event:
 *   get:
 *     summary: Per-event registration and revenue breakdown (admin)
 *     tags: [AdminAnalytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Per-event rows }
 */
router.get('/by-event', validateQuery, asyncHandler(getAnalyticsByEvent));

export default router;
