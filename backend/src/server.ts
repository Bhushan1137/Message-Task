import { createApp } from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './utils/database';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    await connectDatabase();

    const app = createApp();

    const server = app.listen(config.port, () => {
      logger.info(
        { port: config.port, env: config.nodeEnv },
        `Server started on port ${config.port}`
      );
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received');
      server.close(async () => {
        await disconnectDatabase();
        logger.info('Server and database connection closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
