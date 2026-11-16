import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createMessage,
  getMessageById,
  getMessages,
  getConversationMessages,
  getConversations,
  getDashboardStats,
} from './message.service';
import {
  createMessageSchema,
  paginationSchema,
  messageFilterSchema,
} from './message.schema';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export async function createMessageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = createMessageSchema.parse(req.body);

    // Verify tenantId if provided in body matches the authenticated tenant
    if (body.tenantId && body.tenantId !== req.tenantId) {
      next(new ValidationError('tenantId in request body does not match authenticated tenant'));
      return;
    }

    const message = await createMessage({
      tenantId: req.tenantId,
      conversationId: body.conversationId,
      to: body.to,
      text: body.text,
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}

export async function getMessageController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const messageId = req.params['messageId'] as string;
    const message = await getMessageById(messageId, req.tenantId);

    if (!message) {
      next(new NotFoundError('Message not found'));
      return;
    }

    res.json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}

export async function getMessagesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filter = messageFilterSchema.parse(req.query);
    const result = await getMessages(req.tenantId, filter);

    res.json({
      success: true,
      data: result.messages,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getConversationsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = paginationSchema.parse(req.query);
    const search = req.query.search as string | undefined;
    const result = await getConversations(req.tenantId, {
      limit: query.limit,
      cursor: query.cursor,
      search,
    });

    res.json({
      success: true,
      data: result.conversations,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getConversationMessagesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const conversationId = req.params['conversationId'] as string;
    const filter = paginationSchema.parse(req.query);
    const result = await getConversationMessages(req.tenantId, conversationId, filter);

    res.json({
      success: true,
      data: result.messages,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardStatsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await getDashboardStats(req.tenantId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}
