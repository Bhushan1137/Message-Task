import { Router } from 'express';
import {
  providerWebhookController,
  getWebhookEventsController,
  getRecentWebhookActivityController,
} from './webhook.controller';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

// Webhook ingestion - no tenant middleware (simulated provider boundary)
// In production, this would use signature verification (HMAC)
router.post('/provider', providerWebhookController);

// Event log endpoints - require tenant auth
router.get('/events', tenantMiddleware, getWebhookEventsController);
router.get('/activity', tenantMiddleware, getRecentWebhookActivityController);

export { router as webhookRouter };
