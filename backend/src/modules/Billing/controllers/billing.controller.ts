import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';
import { BillingService } from '../services/billing.service';
import { UsageService } from '../services/usage.service';
import {
  CreateCheckoutOrderDto,
  VerifyPaymentDto,
} from '../models/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly usageService: UsageService,
  ) {}

  @Get('subscription')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getSubscription(@Req() req: any) {
    return this.billingService.GetSubscriptionDetails(req.user.business_id);
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getUsage(@Req() req: any) {
    return this.usageService.GetUsageStats(req.user.business_id);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async createCheckout(@Req() req: any, @Body() dto: CreateCheckoutOrderDto) {
    return this.billingService.CreateCheckoutOrder(req.user.business_id, dto);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async verifyPayment(@Req() req: any, @Body() dto: VerifyPaymentDto) {
    return this.billingService.VerifyPayment(req.user.business_id, dto);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async cancelSubscription(@Req() req: any) {
    return this.billingService.CancelSubscription(req.user.business_id);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    return this.billingService.HandleWebhook(rawBody, signature || '');
  }
}
