import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { messageRouter } from './modules/messages/message.router';
import { conversationRouter } from './modules/conversations/conversation.router';
import { webhookRouter } from './modules/webhooks/webhook.router';
import { errorHandler } from './utils/errorHandler';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { prisma } from './utils/database';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();

  // Basic middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-request-id'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);

  // Health check - no auth required
  app.get('/health', async (req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ err }, 'Health check - database unavailable');
      res.status(503).json({
        status: 'degraded',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // API routes
  app.use('/api/v1/messages', messageRouter);
  app.use('/api/v1/conversations', conversationRouter);
  app.use('/api/v1/webhooks', webhookRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
