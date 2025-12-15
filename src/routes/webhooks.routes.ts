import { Router } from 'express';
import { handlePlataWebhook } from '../controllers/webhooks.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/plata-mono', asyncHandler(handlePlataWebhook));

export default router;
