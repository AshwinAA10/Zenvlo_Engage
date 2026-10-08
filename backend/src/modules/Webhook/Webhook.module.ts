import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookReceiver } from './entities/webhook-receiver.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhookService } from './services/webhook.service';
import { WebhookSecurityService } from './services/webhook-security.service';
import { WebhookController } from './controllers/webhook.controller';
import { QueueModule } from '../Queue/Queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookReceiver, WebhookEvent]),
    QueueModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookSecurityService],
  exports: [WebhookService, WebhookSecurityService, TypeOrmModule],
})
export class WebhookModule {}
