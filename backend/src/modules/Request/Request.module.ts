import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestLog } from './entities/request-log.entity';
import { Customer } from '../Customer/entities/customer.entity';
import { Business } from '../Business/entities/business.entity';
import { RequestService } from './services/request.service';
import { RequestController } from './controllers/request.controller';
import { IntegrationModule } from '../Integration/Integration.module';
import { BillingModule } from '../Billing/Billing.module';
import { WebhookModule } from '../Webhook/Webhook.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestLog, Customer, Business]),
    IntegrationModule,
    BillingModule,
    WebhookModule,
    ConfigModule,
  ],
  controllers: [RequestController],
  providers: [RequestService],
  exports: [RequestService],
})
export class RequestModule {}
