import { Request, Response, NextFunction } from 'express';
import { webhookPayloadSchema, eventLogFilterSchema } from '../messages/message.schema';
import { processWebhook, getWebhookEvents, getRecentWebhookActivity } from './webhook.service';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export async function providerWebhookController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = webhookPayloadSchema.parse(req.body);

    logger.info(
      { eventId: payload.eventId, messageId: payload.messageId, status: payload.status },
      'Webhook received'
    );

    const result = await processWebhook(payload);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'MESSAGE_NOT_FOUND') {
      next(new NotFoundError('Message not found'));
      return;
    }
    next(err);
  }
}

export async function getWebhookEventsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filter = eventLogFilterSchema.parse(req.query);
    const result = await getWebhookEvents({
      ...filter,
      tenantId: req.tenantId,
    });

    res.json({
      success: true,
      data: result.events,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getRecentWebhookActivityController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const events = await getRecentWebhookActivity(req.tenantId);
    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
}
