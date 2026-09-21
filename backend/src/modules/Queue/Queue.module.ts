import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_WEBHOOKS, QUEUE_MESSAGES, QUEUE_CAMPAIGNS } from '../../common/constants';
import { QueueService } from './services/queue.service';
import { WebhookProcessor } from './processors/webhook.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_WEBHOOKS },
      { name: QUEUE_MESSAGES },
      { name: QUEUE_CAMPAIGNS },
    ),
  ],
  providers: [QueueService, WebhookProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
