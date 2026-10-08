import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Subscription,
  PlanType,
  BillingCycle,
  SubscriptionStatus,
} from '../entities/subscription.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentWebhookEvent } from '../entities/payment-webhook-event.entity';
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
import { EVENT_AUDIT_RECORD } from '../../../common/constants';
import { AuditRecordEvent } from '../../../events/audit.event';

@Injectable()
export class BillingService {
  // In-flight mutex locks for concurrent duplicate webhook handling
  private readonly inFlightWebhookLocks = new Map<string, Promise<any>>();

  constructor(
    private readonly logger: PinoLogger,
    @Inject(RAZORPAY_SERVICE)
    private readonly razorpayService: IRazorpayService,
    private readonly usageService: UsageService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
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
      // Free plan has far future period
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

    // Audit and transition expired subscriptions
    const now = new Date();
    if (
      sub.plan !== 'FREE' &&
      sub.subscription_status === 'ACTIVE' &&
      sub.current_period_end &&
      sub.current_period_end < now
    ) {
      this.logger.info({
        msg: 'Subscription period ended without renewal; transitioning to EXPIRED and fallback to FREE',
        businessId,
        endedAt: sub.current_period_end,
      });

      sub.subscription_status = 'EXPIRED';
      sub.plan = 'FREE';
      await sub.save();
      await this.usageService.SyncUsageLimitForPlan(businessId, 'FREE');
    }

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

    // Persist Payment record bound to this business and plan
    const payment = new Payment();
    payment.business_id = businessId;
    payment.razorpay_order_id = order.id;
    payment.amount = order.amount;
    payment.currency = order.currency;
    payment.plan = dto.plan;
    payment.billing_cycle = billingCycle;
    payment.receipt = receipt;
    payment.payment_status = 'CREATED';
    await payment.save();

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
    // 1. Verify HMAC payment signature
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

    // 2. Cross-Tenant & Order Validation: Look up pre-created Payment order
    const payment = await Payment.findOne({
      where: { razorpay_order_id: dto.razorpay_order_id },
    });

    if (payment) {
      // Cross-tenant check: ensure order belongs strictly to requesting business
      if (payment.business_id !== businessId) {
        this.logger.error({
          msg: 'Cross-tenant payment verification attempt rejected',
          orderBusinessId: payment.business_id,
          requestBusinessId: businessId,
          orderId: dto.razorpay_order_id,
        });
        throw new BadRequestException(
          'Cross-tenant payment rejected: Order does not belong to this business',
        );
      }

      // Ensure plan and cycle match the created order
      if (
        payment.plan !== dto.plan ||
        (dto.billing_cycle && payment.billing_cycle !== dto.billing_cycle)
      ) {
        throw new BadRequestException(
          'Plan or billing cycle does not match checkout order',
        );
      }

      // Duplicate payment check: already captured
      if (
        payment.payment_status === 'CAPTURED' &&
        payment.razorpay_payment_id === dto.razorpay_payment_id
      ) {
        this.logger.info({
          msg: 'Payment already processed and captured. Returning active subscription.',
          businessId,
          paymentId: dto.razorpay_payment_id,
        });
        const sub = await this.GetOrCreateSubscription(businessId);
        return {
          success: true,
          subscription: sub,
          message: `Subscription already active for ${dto.plan} plan.`,
        };
      }
    }

    // 3. Payment State Validation using trusted Razorpay verification
    if (this.razorpayService.fetchPayment) {
      const livePayment = await this.razorpayService.fetchPayment(
        dto.razorpay_payment_id,
      );
      if (livePayment) {
        if (
          livePayment.status !== 'captured' &&
          livePayment.status !== 'authorized'
        ) {
          this.logger.error({
            msg: 'Payment state validation failed',
            liveStatus: livePayment.status,
            paymentId: dto.razorpay_payment_id,
          });
          throw new BadRequestException(
            `Invalid payment state: payment is ${livePayment.status}`,
          );
        }
        if (
          livePayment.order_id &&
          livePayment.order_id !== dto.razorpay_order_id
        ) {
          throw new BadRequestException(
            'Payment does not match the provided order ID',
          );
        }
      }
    }

    // 4. Duplicate payment check: ensure payment ID hasn't been used on another order
    const existingWithPaymentId = await Payment.findOne({
      where: { razorpay_payment_id: dto.razorpay_payment_id },
    });
    if (existingWithPaymentId && existingWithPaymentId.id !== payment?.id) {
      this.logger.error({
        msg: 'Duplicate payment ID attempt detected across different orders',
        paymentId: dto.razorpay_payment_id,
      });
      throw new BadRequestException(
        'Payment ID has already been processed for another order',
      );
    }

    // 5. Update Payment Record
    if (payment) {
      payment.payment_status = 'CAPTURED';
      payment.razorpay_payment_id = dto.razorpay_payment_id;
      await payment.save();
    } else {
      // Create payment record if not pre-saved
      const newPayment = new Payment();
      newPayment.business_id = businessId;
      newPayment.razorpay_order_id = dto.razorpay_order_id;
      newPayment.razorpay_payment_id = dto.razorpay_payment_id;
      const planCost =
        PLAN_CONFIGS[dto.plan]?.[
          dto.billing_cycle === 'YEARLY' ? 'yearlyPrice' : 'monthlyPrice'
        ] || 0;
      newPayment.amount = planCost * 100;
      newPayment.currency = 'INR';
      newPayment.plan = dto.plan;
      newPayment.billing_cycle = dto.billing_cycle || 'MONTHLY';
      newPayment.payment_status = 'CAPTURED';
      await newPayment.save();
    }

    // 6. Upgrade or activate subscription
    let sub = await Subscription.findOne({
      where: { business_id: businessId },
      order: { created_on: 'DESC' },
    });

    if (!sub) {
      sub = new Subscription();
      sub.business_id = businessId;
    }

    const now = new Date();
    const billingCycle = dto.billing_cycle || payment?.billing_cycle || 'MONTHLY';
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

    // 7. Sync usage limits for upgraded plan
    await this.usageService.SyncUsageLimitForPlan(businessId, dto.plan);

    // 8. Audit event
    if (this.eventEmitter) {
      this.eventEmitter.emit(
        EVENT_AUDIT_RECORD,
        new AuditRecordEvent(
          businessId,
          businessId,
          'PAYMENT_CAPTURED',
          'Subscription',
          sub.id,
          {
            plan: dto.plan,
            billingCycle,
            orderId: dto.razorpay_order_id,
            paymentId: dto.razorpay_payment_id,
          },
        ),
      );
    }

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

    if (this.eventEmitter) {
      this.eventEmitter.emit(
        EVENT_AUDIT_RECORD,
        new AuditRecordEvent(
          businessId,
          businessId,
          'SUBSCRIPTION_CANCELLED_PENDING',
          'Subscription',
          sub.id,
          { current_period_end: sub.current_period_end },
        ),
      );
    }

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

  async HandleWebhook(
    rawBody: string,
    signature: string,
    eventIdHeader?: string,
  ) {
    // 1. Signature Verification
    const isValid = this.razorpayService.verifyWebhookSignature(
      rawBody,
      signature,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Safe Parsing & Structural Validation
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch (err: any) {
      throw new BadRequestException(`Malformed webhook JSON: ${err.message}`);
    }

    if (!event || typeof event !== 'object' || !event.event) {
      throw new BadRequestException('Invalid webhook event payload structure');
    }

    // 3. Extract event ID for deduplication
    const eventId =
      eventIdHeader ||
      event.id ||
      event.event_id ||
      `${event.event}_${
        event.payload?.payment?.entity?.id ||
        event.payload?.order?.entity?.id ||
        event.created_at ||
        Date.now()
      }`;

    // 4. In-flight Concurrency Mutex & Database Idempotency Check
    const activeLock = this.inFlightWebhookLocks.get(eventId);
    if (activeLock) {
      this.logger.info({
        msg: 'Concurrent duplicate webhook detected. Awaiting active execution.',
        eventId,
      });
      await activeLock;
      return { received: true, status: 'DUPLICATE_IGNORED' };
    }

    // Acquire lock synchronously before any async operations
    let releaseLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.inFlightWebhookLocks.set(eventId, lockPromise);

    try {
      const existingEvent = await PaymentWebhookEvent.findOne({
        where: { event_id: eventId },
      });
      if (existingEvent) {
        this.logger.info({
          msg: 'Duplicate webhook event ignored (already processed)',
          eventId,
        });
        return { received: true, status: 'DUPLICATE_IGNORED' };
      }
      this.logger.info({
        msg: 'Processing Razorpay webhook event',
        eventType: event.event,
        eventId,
      });

      // 5. Route Event by Type
      switch (event.event) {
        case 'order.paid':
        case 'payment.captured': {
          const paymentEntity = event.payload?.payment?.entity;
          const orderEntity = event.payload?.order?.entity;
          const paymentId = paymentEntity?.id;
          const orderId = paymentEntity?.order_id || orderEntity?.id;

          if (orderId && paymentId) {
            const payment = await Payment.findOne({
              where: { razorpay_order_id: orderId },
            });

            if (payment && payment.payment_status !== 'CAPTURED') {
              payment.payment_status = 'CAPTURED';
              payment.razorpay_payment_id = paymentId;
              await payment.save();

              // Upgrade subscription
              const sub = await this.GetOrCreateSubscription(payment.business_id);
              const now = new Date();
              const periodEnd = new Date(now);
              if (payment.billing_cycle === 'YEARLY') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
              } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
              }

              sub.plan = payment.plan;
              sub.billing_cycle = payment.billing_cycle;
              sub.subscription_status = 'ACTIVE';
              sub.razorpay_order_id = orderId;
              sub.razorpay_payment_id = paymentId;
              sub.current_period_start = now;
              sub.current_period_end = periodEnd;
              sub.cancel_at_period_end = false;
              sub.canceled_at = null;
              await sub.save();

              await this.usageService.SyncUsageLimitForPlan(
                payment.business_id,
                payment.plan,
              );
            }
          }
          break;
        }

        case 'payment.failed': {
          const paymentEntity = event.payload?.payment?.entity;
          const orderId = paymentEntity?.order_id;
          const paymentId = paymentEntity?.id;

          if (orderId) {
            const payment = await Payment.findOne({
              where: { razorpay_order_id: orderId },
            });

            if (payment) {
              payment.payment_status = 'FAILED';
              payment.razorpay_payment_id = paymentId || payment.razorpay_payment_id;
              payment.error_code = paymentEntity?.error_code || 'PAYMENT_FAILED';
              payment.error_description =
                paymentEntity?.error_description || 'Payment failed';
              await payment.save();

              // If linked to active subscription, mark as PAST_DUE
              const sub = await Subscription.findOne({
                where: { business_id: payment.business_id },
              });
              if (sub && sub.subscription_status === 'ACTIVE' && sub.plan !== 'FREE') {
                sub.subscription_status = 'PAST_DUE';
                await sub.save();
              }
            }
          }
          break;
        }

        case 'subscription.charged': {
          // Automatic renewal event
          const subEntity = event.payload?.subscription?.entity;
          const paymentEntity = event.payload?.payment?.entity;
          const subId = subEntity?.id;
          const paymentId = paymentEntity?.id;
          const businessId =
            subEntity?.notes?.businessId || paymentEntity?.notes?.businessId;

          let sub: Subscription | null = null;
          if (subId) {
            sub = await Subscription.findOne({
              where: { razorpay_subscription_id: subId },
            });
          }
          if (!sub && businessId) {
            sub = await Subscription.findOne({
              where: { business_id: businessId },
            });
          }

          if (sub && paymentId) {
            // Check renewal idempotency: prevent duplicate renewal for same payment
            const existingRenewalPayment = await Payment.findOne({
              where: { razorpay_payment_id: paymentId },
            });

            if (!existingRenewalPayment) {
              // Deterministic state transition: extend subscription period
              const currentEnd = sub.current_period_end
                ? new Date(sub.current_period_end)
                : new Date();
              const newEnd = new Date(currentEnd);

              if (sub.billing_cycle === 'YEARLY') {
                newEnd.setFullYear(newEnd.getFullYear() + 1);
              } else {
                newEnd.setMonth(newEnd.getMonth() + 1);
              }

              sub.current_period_start = currentEnd;
              sub.current_period_end = newEnd;
              sub.subscription_status = 'ACTIVE';
              sub.razorpay_payment_id = paymentId;
              await sub.save();

              // Record renewal payment
              const renewalPayment = new Payment();
              renewalPayment.business_id = sub.business_id;
              renewalPayment.razorpay_order_id =
                paymentEntity?.order_id || `order_renew_${paymentId}`;
              renewalPayment.razorpay_payment_id = paymentId;
              renewalPayment.amount = paymentEntity?.amount || 0;
              renewalPayment.currency = paymentEntity?.currency || 'INR';
              renewalPayment.plan = sub.plan;
              renewalPayment.billing_cycle = sub.billing_cycle;
              renewalPayment.payment_status = 'CAPTURED';
              await renewalPayment.save();

              if (this.eventEmitter) {
                this.eventEmitter.emit(
                  EVENT_AUDIT_RECORD,
                  new AuditRecordEvent(
                    sub.business_id,
                    sub.business_id,
                    'SUBSCRIPTION_RENEWED',
                    'Subscription',
                    sub.id,
                    {
                      paymentId,
                      periodEnd: newEnd,
                    },
                  ),
                );
              }
            }
          }
          break;
        }

        case 'subscription.halted': {
          // Renewal retries exhausted
          const subEntity = event.payload?.subscription?.entity;
          const subId = subEntity?.id;
          const businessId = subEntity?.notes?.businessId;

          let sub: Subscription | null = null;
          if (subId) {
            sub = await Subscription.findOne({
              where: { razorpay_subscription_id: subId },
            });
          }
          if (!sub && businessId) {
            sub = await Subscription.findOne({
              where: { business_id: businessId },
            });
          }

          if (sub) {
            sub.subscription_status = 'PAST_DUE';
            await sub.save();

            if (this.eventEmitter) {
              this.eventEmitter.emit(
                EVENT_AUDIT_RECORD,
                new AuditRecordEvent(
                  sub.business_id,
                  sub.business_id,
                  'SUBSCRIPTION_HALTED',
                  'Subscription',
                  sub.id,
                  { reason: 'Renewal payment retries exhausted' },
                ),
              );
            }
          }
          break;
        }

        case 'subscription.cancelled': {
          const subEntity = event.payload?.subscription?.entity;
          const subId = subEntity?.id;
          const businessId = subEntity?.notes?.businessId;

          let sub: Subscription | null = null;
          if (subId) {
            sub = await Subscription.findOne({
              where: { razorpay_subscription_id: subId },
            });
          }
          if (!sub && businessId) {
            sub = await Subscription.findOne({
              where: { business_id: businessId },
            });
          }

          if (sub) {
            sub.subscription_status = 'CANCELLED';
            sub.canceled_at = new Date();
            await sub.save();

            if (this.eventEmitter) {
              this.eventEmitter.emit(
                EVENT_AUDIT_RECORD,
                new AuditRecordEvent(
                  sub.business_id,
                  sub.business_id,
                  'SUBSCRIPTION_CANCELLED',
                  'Subscription',
                  sub.id,
                  {},
                ),
              );
            }
          }
          break;
        }

        case 'refund.processed':
        case 'payment.refunded': {
          const refundEntity = event.payload?.refund?.entity;
          const paymentId =
            refundEntity?.payment_id || event.payload?.payment?.entity?.id;
          const refundId = refundEntity?.id;
          const amount = refundEntity?.amount;

          if (paymentId) {
            const payment = await Payment.findOne({
              where: { razorpay_payment_id: paymentId },
            });

            if (payment) {
              payment.payment_status = 'REFUNDED';
              payment.refund_id = refundId || null;
              payment.refund_amount = amount || payment.amount;
              await payment.save();

              // Revert subscription to FREE plan
              const sub = await Subscription.findOne({
                where: { business_id: payment.business_id },
              });
              if (sub) {
                sub.plan = 'FREE';
                sub.subscription_status = 'ACTIVE';
                await sub.save();
                await this.usageService.SyncUsageLimitForPlan(
                  payment.business_id,
                  'FREE',
                );
              }

              if (this.eventEmitter) {
                this.eventEmitter.emit(
                  EVENT_AUDIT_RECORD,
                  new AuditRecordEvent(
                    payment.business_id,
                    payment.business_id,
                    'PAYMENT_REFUNDED',
                    'Payment',
                    payment.id,
                    { paymentId, refundId, amount },
                  ),
                );
              }
            }
          }
          break;
        }

        default: {
          this.logger.info({
            msg: `Unhandled Razorpay webhook event type: ${event.event}`,
          });
        }
      }

      // 6. Persist Webhook Event Record for idempotency
      const webhookRecord = new PaymentWebhookEvent();
      webhookRecord.event_id = eventId;
      webhookRecord.event_type = event.event;
      webhookRecord.payload = event;
      webhookRecord.status = 'PROCESSED';
      await webhookRecord.save();

      return {
        received: true,
        status: 'PROCESSED',
        event: event.event,
        eventId,
      };
    } finally {
      this.inFlightWebhookLocks.delete(eventId);
      releaseLock();
    }
  }
}
