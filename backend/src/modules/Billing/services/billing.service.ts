import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Subscription, PlanType, BillingCycle } from '../entities/subscription.entity';
import {
  RAZORPAY_SERVICE,
  IRazorpayService,
} from '../../Integration/interfaces/razorpay.interface';
import { UsageService } from './usage.service';
import {
  CreateCheckoutOrderDto,
  VerifyPaymentDto,
  PLAN_CONFIGS,
} from '../models/billing.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly logger: PinoLogger,
    @Inject(RAZORPAY_SERVICE)
    private readonly razorpayService: IRazorpayService,
    private readonly usageService: UsageService,
  ) {
    this.logger.setContext(BillingService.name);
  }

  async GetOrCreateSubscription(businessId: string): Promise<Subscription> {
    let sub = await Subscription.findOne({
      where: { business_id: businessId },
      order: { created_on: 'DESC' },
    });

    if (!sub) {
      // Default to FREE plan
      sub = new Subscription();
      sub.business_id = businessId;
      sub.plan = 'FREE';
      sub.billing_cycle = 'MONTHLY';
      sub.subscription_status = 'ACTIVE';
      sub.current_period_start = new Date();
      // Free plan has a far future period
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 10);
      sub.current_period_end = farFuture;
      sub.cancel_at_period_end = false;
      await sub.save();
    }

    return sub;
  }

  async GetSubscriptionDetails(businessId: string) {
    const sub = await this.GetOrCreateSubscription(businessId);
    const usageStats = await this.usageService.GetUsageStats(businessId);
    const planConfig = PLAN_CONFIGS[sub.plan] || PLAN_CONFIGS.FREE;

    return {
      subscription: {
        id: sub.id,
        plan: sub.plan,
        billing_cycle: sub.billing_cycle,
        status: sub.subscription_status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
      },
      plan: {
        name: sub.plan,
        monthlyPrice: planConfig.monthlyPrice,
        yearlyPrice: planConfig.yearlyPrice,
        features: planConfig.features,
      },
      usage: usageStats,
      plans_available: PLAN_CONFIGS,
    };
  }

  async CreateCheckoutOrder(
    businessId: string,
    dto: CreateCheckoutOrderDto,
  ) {
    const planConfig = PLAN_CONFIGS[dto.plan];
    if (!planConfig) {
      throw new BadRequestException(`Invalid plan selected: ${dto.plan}`);
    }

    const billingCycle = dto.billing_cycle || 'MONTHLY';
    const amountInRupees =
      billingCycle === 'YEARLY'
        ? planConfig.yearlyPrice
        : planConfig.monthlyPrice;

    if (amountInRupees <= 0) {
      throw new BadRequestException('Cannot create payment order for free plan');
    }

    const amountInPaise = amountInRupees * 100;
    const receipt = `rcpt_${businessId.substring(0, 8)}_${Date.now()}`;

    const order = await this.razorpayService.createOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        businessId,
        plan: dto.plan,
        billingCycle,
      },
    });

    this.logger.info({
      msg: 'Created Razorpay checkout order for subscription upgrade',
      businessId,
      orderId: order.id,
      plan: dto.plan,
      amountInRupees,
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: order.key_id,
      plan: dto.plan,
      billingCycle,
      businessId,
    };
  }

  async VerifyPayment(businessId: string, dto: VerifyPaymentDto) {
    const isValid = this.razorpayService.verifyPaymentSignature({
      orderId: dto.razorpay_order_id,
      paymentId: dto.razorpay_payment_id,
      signature: dto.razorpay_signature,
    });

    if (!isValid) {
      this.logger.error({
        msg: 'Payment verification failed: invalid signature',
        businessId,
        orderId: dto.razorpay_order_id,
      });
      throw new BadRequestException('Invalid payment signature');
    }

    // Upgrade or activate subscription
    let sub = await Subscription.findOne({
      where: { business_id: businessId },
      order: { created_on: 'DESC' },
    });

    if (!sub) {
      sub = new Subscription();
      sub.business_id = businessId;
    }

    const now = new Date();
    const billingCycle = dto.billing_cycle || 'MONTHLY';
    const periodEnd = new Date(now);

    if (billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    sub.plan = dto.plan;
    sub.billing_cycle = billingCycle;
    sub.subscription_status = 'ACTIVE';
    sub.razorpay_order_id = dto.razorpay_order_id;
    sub.razorpay_payment_id = dto.razorpay_payment_id;
    sub.current_period_start = now;
    sub.current_period_end = periodEnd;
    sub.cancel_at_period_end = false;
    sub.canceled_at = null;

    await sub.save();

    // Sync usage limits for upgraded plan
    await this.usageService.SyncUsageLimitForPlan(businessId, dto.plan);

    this.logger.info({
      msg: 'Successfully upgraded business subscription',
      businessId,
      plan: dto.plan,
      billingCycle,
      orderId: dto.razorpay_order_id,
    });

    return {
      success: true,
      subscription: sub,
      message: `Upgraded to ${dto.plan} plan successfully!`,
    };
  }

  async CancelSubscription(businessId: string) {
    const sub = await Subscription.findOne({
      where: { business_id: businessId, subscription_status: 'ACTIVE' },
    });

    if (!sub) {
      throw new NotFoundException('Active subscription not found');
    }

    if (sub.plan === 'FREE') {
      throw new BadRequestException('Free plan cannot be canceled');
    }

    sub.cancel_at_period_end = true;
    sub.canceled_at = new Date();
    await sub.save();

    this.logger.info({
      msg: 'Marked subscription for cancellation at period end',
      businessId,
      periodEnd: sub.current_period_end,
    });

    return {
      success: true,
      message: 'Subscription will remain active until the end of the billing period.',
      current_period_end: sub.current_period_end,
    };
  }

  async HandleWebhook(rawBody: string, signature: string) {
    const isValid = this.razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    try {
      const event = JSON.parse(rawBody);
      this.logger.info({
        msg: 'Received Razorpay webhook event',
        eventType: event.event,
      });

      // Handle subscription renewal or payment events if needed
      return { received: true };
    } catch (err: any) {
      throw new BadRequestException(`Webhook payload error: ${err.message}`);
    }
  }
}
