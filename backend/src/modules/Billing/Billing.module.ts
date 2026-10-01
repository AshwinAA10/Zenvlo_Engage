import { Module } from '@nestjs/common';
import { BillingController } from './controllers/billing.controller';
import { BillingService } from './services/billing.service';
import { UsageService } from './services/usage.service';
import { IntegrationModule } from '../Integration/Integration.module';

@Module({
  imports: [IntegrationModule],
  controllers: [BillingController],
  providers: [BillingService, UsageService],
  exports: [BillingService, UsageService],
})
export class BillingModule {}
