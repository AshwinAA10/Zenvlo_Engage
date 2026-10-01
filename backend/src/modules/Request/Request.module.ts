import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestLog } from './entities/request-log.entity';
import { Customer } from '../Customer/entities/customer.entity';
import { Business } from '../Business/entities/business.entity';
import { RequestService } from './services/request.service';
import { RequestController } from './controllers/request.controller';
import { IntegrationModule } from '../Integration/Integration.module';
import { BillingModule } from '../Billing/Billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestLog, Customer, Business]),
    IntegrationModule,
    BillingModule,
  ],
  controllers: [RequestController],
  providers: [RequestService],
  exports: [RequestService],
})
export class RequestModule {}
