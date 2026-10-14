import { Module, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  QUEUE_SYSTEM,
  QUEUE_WEBHOOKS,
  QUEUE_MESSAGES,
  QUEUE_CAMPAIGNS,
  QUEUE_WHATSAPP_OUTBOUND,
} from '../../common/constants';
import { QueueService } from './services/queue.service';
import { QueueHealthService } from './services/queue-health.service';
import { QueueAdminService } from './services/queue-admin.service';
import { QueueAdminController } from './controllers/queue-admin.controller';
import { WebhookProcessor } from './processors/webhook.processor';
import { SystemProcessor } from './processors/system.processor';
import { WhatsAppOutboundProcessor } from './processors/whatsapp-outbound.processor';
import { getRedisConnectionConfig, getDefaultJobOptions } from './config/queue.config';
import { IntegrationModule } from '../Integration/Integration.module';
import { BillingModule } from '../Billing/Billing.module';

const isWorkersEnabled = (): boolean => {
  return (process.env.ENABLE_WORKERS || 'true').toLowerCase() !== 'false';
};

const defaultWorkerProviders = isWorkersEnabled()
  ? [WebhookProcessor, SystemProcessor, WhatsAppOutboundProcessor]
  : [];

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: getRedisConnectionConfig(configService),
        defaultJobOptions: getDefaultJobOptions(configService),
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_SYSTEM },
      { name: QUEUE_WEBHOOKS },
      { name: QUEUE_MESSAGES },
      { name: QUEUE_CAMPAIGNS },
      { name: QUEUE_WHATSAPP_OUTBOUND },
    ),
    IntegrationModule,
    BillingModule,
  ],
  controllers: [QueueAdminController],
  providers: [
    QueueService,
    QueueHealthService,
    QueueAdminService,
    ...defaultWorkerProviders,
  ],
  exports: [QueueService, QueueHealthService, QueueAdminService, BullModule],
})
export class QueueModule {
  /**
   * Allows dynamic registration with explicit control over worker execution
   * (e.g. for API-only nodes where enableWorkers: false, or isolated test runners).
   */
  static register(options?: { enableWorkers?: boolean }): DynamicModule {
    const enable = options?.enableWorkers ?? isWorkersEnabled();
    const workers = enable
      ? [WebhookProcessor, SystemProcessor, WhatsAppOutboundProcessor]
      : [];

    return {
      module: QueueModule,
      imports: [
        BullModule.registerQueue(
          { name: QUEUE_SYSTEM },
          { name: QUEUE_WEBHOOKS },
          { name: QUEUE_MESSAGES },
          { name: QUEUE_CAMPAIGNS },
          { name: QUEUE_WHATSAPP_OUTBOUND },
        ),
        IntegrationModule,
        BillingModule,
      ],
      controllers: [QueueAdminController],
      providers: [QueueService, QueueHealthService, QueueAdminService, ...workers],
      exports: [QueueService, QueueHealthService, QueueAdminService, BullModule],
    };
  }
}
