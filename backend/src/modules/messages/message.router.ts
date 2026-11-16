import { Router } from 'express';
import {
  createMessageController,
  getMessageController,
  getMessagesController,
  getConversationsController,
  getConversationMessagesController,
  getDashboardStatsController,
} from './message.controller';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

// All message routes require tenant auth
router.use(tenantMiddleware);

router.post('/', createMessageController);
router.get('/stats', getDashboardStatsController);
router.get('/', getMessagesController);
router.get('/:messageId', getMessageController);

export { router as messageRouter };
