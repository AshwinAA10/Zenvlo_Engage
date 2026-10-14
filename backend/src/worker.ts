import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

/**
 * Standalone BullMQ Worker Bootstrap.
 * Runs independently of HTTP API instances, executing asynchronous queue jobs.
 */
async function bootstrapWorker() {
  process.env.ENABLE_WORKERS = 'true';

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.enableShutdownHooks();

  logger.log(
    'Zenvlo Engage BullMQ Worker Service started successfully. Processing queues independently of API...',
  );

  const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of shutdownSignals) {
    process.on(signal, async () => {
      logger.log(`Worker received ${signal}. Initiating graceful shutdown...`);
      try {
        await app.close();
        logger.log('Worker shutdown completed cleanly.');
        process.exit(0);
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error occurred during worker shutdown');
        process.exit(1);
      }
    });
  }
}

bootstrapWorker().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap BullMQ worker process:', err);
  process.exit(1);
});
