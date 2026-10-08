import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as crypto from 'crypto';
import { BillingService } from './services/billing.service';
import { UsageService } from './services/usage.service';
import { Subscription } from './entities/subscription.entity';
import { Payment } from './entities/payment.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { RazorpayService } from '../Integration/services/razorpay.service';

describe('Razorpay Payment & Webhook Security (Phase 9F)', () => {
  let billingService: BillingService;
  let razorpayService: RazorpayService;
  let usageService: UsageService;

  const tenantA = 'aaaaaaaa-0000-0000-0000-000000000001';
  const tenantB = 'bbbbbbbb-0000-0000-0000-000000000002';
  const testWebhookSecret = 'test_webhook_secret_key_32_bytes_len_abc';
  const testKeySecret = 'test_key_secret_key_32_bytes_len_xyz';

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_sec_key_123';
        if (key === 'RAZORPAY_KEY_SECRET') return testKeySecret;
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return testWebhookSecret;
        return undefined;
      }),
    };

    const mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    razorpayService = new RazorpayService(
      mockLogger as any,
      mockConfigService as any,
    );

    usageService = {
      GetUsageStats: jest.fn().mockResolvedValue({
        period_month: '2026-10',
        whatsapp_requests_sent: 0,
        whatsapp_requests_limit: 50,
      }),
      SyncUsageLimitForPlan: jest.fn().mockResolvedValue(undefined),
    } as any;

    billingService = new BillingService(
      mockLogger as any,
      razorpayService,
      usageService,
      { emit: jest.fn() } as any,
    );
  });

  describe('1. Webhook Signature Verification', () => {
    it('should verify valid HMAC-SHA256 signature generated with webhook secret', () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        entity: 'event',
      });
      const validSignature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(payload, 'utf8')
        .digest('hex');

      const isValid = razorpayService.verifyWebhookSignature(
        payload,
        validSignature,
      );
      expect(isValid).toBe(true);
    });

    it('should reject invalid, forged, or altered signatures in constant time', () => {
      const payload = JSON.stringify({ event: 'payment.captured' });
      const invalidSignature = 'a'.repeat(64);

      const isValid = razorpayService.verifyWebhookSignature(
        payload,
        invalidSignature,
      );
      expect(isValid).toBe(false);
    });

    it('should reject empty or missing signatures immediately', () => {
      const payload = JSON.stringify({ event: 'payment.captured' });
      expect(razorpayService.verifyWebhookSignature(payload, '')).toBe(false);
      expect(razorpayService.verifyWebhookSignature('', 'sig')).toBe(false);
    });

    it('should throw BadRequestException on invalid signature in HandleWebhook', async () => {
      const rawBody = JSON.stringify({ event: 'payment.captured' });
      await expect(
        billingService.HandleWebhook(rawBody, 'invalid_signature_hex_12345'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Webhook Idempotency & Replay Protection', () => {
    it('should process a valid webhook event on first arrival and persist webhook event record', async () => {
      const eventPayload = {
        id: 'evt_first_seen_101',
        event: 'order.paid',
        payload: {
          order: { entity: { id: 'order_101', status: 'paid' } },
          payment: {
            entity: { id: 'pay_101', order_id: 'order_101', status: 'captured' },
          },
        },
      };

      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(rawBody, 'utf8')
        .digest('hex');

      // Spies
      jest.spyOn(PaymentWebhookEvent, 'findOne').mockResolvedValue(null);
      const mockWebhookSave = jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
      jest
        .spyOn(PaymentWebhookEvent.prototype, 'save')
        .mockImplementation(mockWebhookSave);

      const mockPayment = {
        id: 'pmt-1',
        business_id: tenantA,
        razorpay_order_id: 'order_101',
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
        payment_status: 'CREATED',
        save: jest.fn().mockResolvedValue(true),
      } as any;
      jest.spyOn(Payment, 'findOne').mockResolvedValue(mockPayment);

      const mockSub = {
        id: 'sub-1',
        business_id: tenantA,
        plan: 'FREE',
        save: jest.fn().mockResolvedValue(true),
      } as any;
      jest.spyOn(Subscription, 'findOne').mockResolvedValue(mockSub);

      const result = await billingService.HandleWebhook(rawBody, signature);

      expect(result.received).toBe(true);
      expect(result.status).toBe('PROCESSED');
      expect(mockPayment.payment_status).toBe('CAPTURED');
      expect(mockSub.plan).toBe('GROWTH');
      expect(mockWebhookSave).toHaveBeenCalled();
    });

    it('should ignore duplicate replayed webhook events without applying duplicate business logic', async () => {
      const eventPayload = {
        id: 'evt_replayed_202',
        event: 'order.paid',
        payload: {
          order: { entity: { id: 'order_202' } },
          payment: { entity: { id: 'pay_202', order_id: 'order_202' } },
        },
      };

      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(rawBody, 'utf8')
        .digest('hex');

      // Database already contains this event_id
      jest.spyOn(PaymentWebhookEvent, 'findOne').mockResolvedValue({
        id: 'wh-record-1',
        event_id: 'evt_replayed_202',
      } as any);

      const paymentFindSpy = jest.spyOn(Payment, 'findOne');

      const result = await billingService.HandleWebhook(rawBody, signature);

      expect(result.received).toBe(true);
      expect(result.status).toBe('DUPLICATE_IGNORED');
      // Must not query or touch payments again
      expect(paymentFindSpy).not.toHaveBeenCalled();
    });

    it('should serialize concurrent duplicate webhook requests and execute only once', async () => {
      const eventPayload = {
        id: 'evt_concurrent_303',
        event: 'order.paid',
        payload: {
          order: { entity: { id: 'order_303' } },
          payment: { entity: { id: 'pay_303', order_id: 'order_303' } },
        },
      };

      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(rawBody, 'utf8')
        .digest('hex');

      let executionCount = 0;
      jest.spyOn(PaymentWebhookEvent, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(PaymentWebhookEvent.prototype, 'save')
        .mockImplementation(function (this: any) {
          executionCount++;
          return Promise.resolve(this);
        });

      const mockPayment = {
        id: 'pmt-303',
        business_id: tenantA,
        razorpay_order_id: 'order_303',
        plan: 'GROWTH',
        payment_status: 'CREATED',
        save: jest.fn().mockResolvedValue(true),
      } as any;
      jest.spyOn(Payment, 'findOne').mockResolvedValue(mockPayment);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: tenantA,
        save: jest.fn().mockResolvedValue(true),
      } as any);

      // Fire 3 simultaneous concurrent webhook calls with identical event_id
      const [res1, res2, res3] = await Promise.all([
        billingService.HandleWebhook(rawBody, signature),
        billingService.HandleWebhook(rawBody, signature),
        billingService.HandleWebhook(rawBody, signature),
      ]);

      const statuses = [res1.status, res2.status, res3.status];
      expect(statuses).toContain('PROCESSED');
      expect(statuses).toContain('DUPLICATE_IGNORED');
      // The actual DB save action must only be called once
      expect(executionCount).toBe(1);
    });
  });

  describe('3. Payment State Validation & Cross-Tenant Security', () => {
    it('should prevent cross-tenant payment verification when order belongs to a different business', async () => {
      // Order created by Tenant B
      const orderCreatedForTenantB = {
        id: 'pmt-b',
        business_id: tenantB, // belongs to tenant B!
        razorpay_order_id: 'order_cross_tenant_999',
        plan: 'ENTERPRISE',
        billing_cycle: 'YEARLY',
        payment_status: 'CREATED',
      } as any;

      jest
        .spyOn(Payment, 'findOne')
        .mockResolvedValue(orderCreatedForTenantB);
      jest
        .spyOn(razorpayService, 'verifyPaymentSignature')
        .mockReturnValue(true);

      // Tenant A tries to verify Tenant B's order
      await expect(
        billingService.VerifyPayment(tenantA, {
          razorpay_order_id: 'order_cross_tenant_999',
          razorpay_payment_id: 'pay_999',
          razorpay_signature: 'sig_valid',
          plan: 'ENTERPRISE',
          billing_cycle: 'YEARLY',
        }),
      ).rejects.toThrow(
        'Cross-tenant payment rejected: Order does not belong to this business',
      );
    });

    it('should reject payment verification if live Razorpay payment state is not captured/authorized', async () => {
      const paymentOrder = {
        id: 'pmt-state-check',
        business_id: tenantA,
        razorpay_order_id: 'order_state_check_1',
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
        payment_status: 'CREATED',
        save: jest.fn().mockResolvedValue(true),
      } as any;

      jest.spyOn(Payment, 'findOne').mockResolvedValue(paymentOrder);
      jest
        .spyOn(razorpayService, 'verifyPaymentSignature')
        .mockReturnValue(true);

      // Razorpay API returns payment status as "failed"
      jest.spyOn(razorpayService, 'fetchPayment').mockResolvedValue({
        id: 'pay_failed_state',
        order_id: 'order_state_check_1',
        status: 'failed',
        amount: 149900,
        currency: 'INR',
      });

      await expect(
        billingService.VerifyPayment(tenantA, {
          razorpay_order_id: 'order_state_check_1',
          razorpay_payment_id: 'pay_failed_state',
          razorpay_signature: 'sig_valid',
          plan: 'GROWTH',
          billing_cycle: 'MONTHLY',
        }),
      ).rejects.toThrow('Invalid payment state: payment is failed');
    });

    it('should prevent duplicate payment reuse across different orders', async () => {
      const currentOrder = {
        id: 'pmt-current',
        business_id: tenantA,
        razorpay_order_id: 'order_new',
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
        payment_status: 'CREATED',
      } as any;

      const alreadyUsedPayment = {
        id: 'pmt-other-old',
        razorpay_payment_id: 'pay_already_consumed_123',
      } as any;

      jest
        .spyOn(Payment, 'findOne')
        .mockResolvedValueOnce(currentOrder) // first lookup by order_id
        .mockResolvedValueOnce(alreadyUsedPayment); // second lookup by payment_id
      jest
        .spyOn(razorpayService, 'verifyPaymentSignature')
        .mockReturnValue(true);
      jest.spyOn(razorpayService, 'fetchPayment').mockResolvedValue(null);

      await expect(
        billingService.VerifyPayment(tenantA, {
          razorpay_order_id: 'order_new',
          razorpay_payment_id: 'pay_already_consumed_123',
          razorpay_signature: 'sig_valid',
          plan: 'GROWTH',
          billing_cycle: 'MONTHLY',
        }),
      ).rejects.toThrow(
        'Payment ID has already been processed for another order',
      );
    });

    it('should handle repeat verification of same already captured payment idempotently', async () => {
      const alreadyCapturedOrder = {
        id: 'pmt-captured-1',
        business_id: tenantA,
        razorpay_order_id: 'order_captured_1',
        razorpay_payment_id: 'pay_captured_1',
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
        payment_status: 'CAPTURED',
      } as any;

      jest
        .spyOn(Payment, 'findOne')
        .mockResolvedValue(alreadyCapturedOrder);
      jest
        .spyOn(razorpayService, 'verifyPaymentSignature')
        .mockReturnValue(true);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: tenantA,
        plan: 'GROWTH',
        subscription_status: 'ACTIVE',
      } as any);

      const result = await billingService.VerifyPayment(tenantA, {
        razorpay_order_id: 'order_captured_1',
        razorpay_payment_id: 'pay_captured_1',
        razorpay_signature: 'sig_valid',
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('already active');
    });
  });

  describe('4. Subscription Renewal Lifecycle', () => {
    it('should process subscription.charged renewal, extend period end, and record renewal payment', async () => {
      const initialEnd = new Date('2026-10-01T00:00:00Z');
      const activeSub = {
        id: 'sub-renew-1',
        business_id: tenantA,
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
        subscription_status: 'ACTIVE',
        current_period_end: initialEnd,
        save: jest.fn().mockResolvedValue(true),
      } as any;

      jest.spyOn(Subscription, 'findOne').mockResolvedValue(activeSub);
      jest.spyOn(Payment, 'findOne').mockResolvedValue(null); // payment not recorded yet
      const mockPaymentSave = jest
        .fn()
        .mockImplementation(function (this: any) {
          return Promise.resolve(this);
        });
      jest.spyOn(Payment.prototype, 'save').mockImplementation(mockPaymentSave);
      jest.spyOn(PaymentWebhookEvent, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(PaymentWebhookEvent.prototype, 'save')
        .mockImplementation(function (this: any) {
          return Promise.resolve(this);
        });

      const renewalPayload = {
        id: 'evt_renewal_1',
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: 'sub_razorpay_123',
              notes: { businessId: tenantA },
            },
          },
          payment: {
            entity: {
              id: 'pay_renewal_999',
              amount: 149900,
              currency: 'INR',
            },
          },
        },
      };

      const rawBody = JSON.stringify(renewalPayload);
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(rawBody, 'utf8')
        .digest('hex');

      const result = await billingService.HandleWebhook(rawBody, signature);

      expect(result.received).toBe(true);
      expect(result.status).toBe('PROCESSED');
      // Sub period must be advanced by 1 month
      expect(activeSub.current_period_end.getMonth()).toBe(10); // November (0-indexed 10)
      expect(activeSub.subscription_status).toBe('ACTIVE');
      expect(mockPaymentSave).toHaveBeenCalled();
    });

    it('should transition subscription to PAST_DUE on subscription.halted when retries exhausted', async () => {
      const activeSub = {
        id: 'sub-halted-1',
        business_id: tenantA,
        subscription_status: 'ACTIVE',
        save: jest.fn().mockResolvedValue(true),
      } as any;

      jest.spyOn(Subscription, 'findOne').mockResolvedValue(activeSub);
      jest.spyOn(PaymentWebhookEvent, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(PaymentWebhookEvent.prototype, 'save')
        .mockImplementation(function (this: any) {
          return Promise.resolve(this);
        });

      const payload = {
        id: 'evt_halted_1',
        event: 'subscription.halted',
        payload: {
          subscription: {
            entity: {
              id: 'sub_razorpay_halt',
              notes: { businessId: tenantA },
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(rawBody)
        .digest('hex');

      await billingService.HandleWebhook(rawBody, signature);

      expect(activeSub.subscription_status).toBe('PAST_DUE');
      expect(activeSub.save).toHaveBeenCalled();
    });

    it('should transition subscription to CANCELLED on subscription.cancelled event', async () => {
      const activeSub = {
        id: 'sub-cancel-1',
        business_id: tenantA,
        subscription_status: 'ACTIVE',
        save: jest.fn().mockResolvedValue(true),
      } as any;

      jest.spyOn(Subscription, 'findOne').mockResolvedValue(activeSub);
      jest.spyOn(PaymentWebhookEvent, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(PaymentWebhookEvent.prototype, 'save')
        .mockImplementation(function (this: any) {
          return Promise.resolve(this);
        });

      const payload = {
        id: 'evt_cancel_1',
        event: 'subscription.cancelled',
        payload: {
          subscription: {
            entity: {
              id: 'sub_razorpay_cancel',
              notes: { businessId: tenantA },
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(rawBody)
        .digest('hex');

      await billingService.HandleWebhook(rawBody, signature);

      expect(activeSub.subscription_status).toBe('CANCELLED');
      expect(activeSub.canceled_at).toBeDefined();
    });
  });

  describe('5. Payment Failure & Refund Handling', () => {
    it('should mark payment as FAILED and active subscription as PAST_DUE on payment.failed', async () => {
      const paymentOrder = {
        id: 'pmt-fail-1',
        business_id: tenantA,
        razorpay_order_id: 'order_fail_1',
        payment_status: 'CREATED',
        save: jest.fn().mockResolvedValue(true),
      } as any;

      const activeSub = {
        business_id: tenantA,
        plan: 'GROWTH',
        subscription_status: 'ACTIVE',
        save: jest.fn().mockResolvedValue(true),
      } as any;

      jest.spyOn(Payment, 'findOne').mockResolvedValue(paymentOrder);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue(activeSub);
      jest.spyOn(PaymentWebhookEvent, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(PaymentWebhookEvent.prototype, 'save')
        .mockImplementation(function (this: any) {
          return Promise.resolve(this);
        });

      const payload = {
        id: 'evt_fail_1',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail_1',
              order_id: 'order_fail_1',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Card expired',
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(rawBody)
        .digest('hex');

      await billingService.HandleWebhook(rawBody, signature);

      expect(paymentOrder.payment_status).toBe('FAILED');
      expect(paymentOrder.error_code).toBe('BAD_REQUEST_ERROR');
      expect(activeSub.subscription_status).toBe('PAST_DUE');
    });

    it('should process refund, mark payment as REFUNDED, and downgrade subscription to FREE', async () => {
      const capturedPayment = {
        id: 'pmt-refund-1',
        business_id: tenantA,
        razorpay_payment_id: 'pay_refund_1',
        amount: 149900,
        payment_status: 'CAPTURED',
        save: jest.fn().mockResolvedValue(true),
      } as any;

      const paidSub = {
        business_id: tenantA,
        plan: 'GROWTH',
        subscription_status: 'ACTIVE',
        save: jest.fn().mockResolvedValue(true),
      } as any;

      jest.spyOn(Payment, 'findOne').mockResolvedValue(capturedPayment);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue(paidSub);
      jest.spyOn(PaymentWebhookEvent, 'findOne').mockResolvedValue(null);
      jest
        .spyOn(PaymentWebhookEvent.prototype, 'save')
        .mockImplementation(function (this: any) {
          return Promise.resolve(this);
        });

      const payload = {
        id: 'evt_refund_1',
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: 'rfnd_123',
              payment_id: 'pay_refund_1',
              amount: 149900,
            },
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(rawBody)
        .digest('hex');

      await billingService.HandleWebhook(rawBody, signature);

      expect(capturedPayment.payment_status).toBe('REFUNDED');
      expect(capturedPayment.refund_id).toBe('rfnd_123');
      expect(paidSub.plan).toBe('FREE');
      expect(usageService.SyncUsageLimitForPlan).toHaveBeenCalledWith(
        tenantA,
        'FREE',
      );
    });
  });
});
