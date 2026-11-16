import { Router } from 'express';
import {
  getConversationsController,
  getConversationMessagesController,
} from '../messages/message.controller';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

router.use(tenantMiddleware);

router.get('/', getConversationsController);
router.get('/:conversationId/messages', getConversationMessagesController);

export { router as conversationRouter };
