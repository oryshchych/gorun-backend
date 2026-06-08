import { Router } from 'express';
import { handlePlataWebhook } from '../controllers/webhooks.controller';
import { webhookLimiter } from '../middleware/rateLimiter.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/plata-mono', webhookLimiter, asyncHandler(handlePlataWebhook));

export default router;
