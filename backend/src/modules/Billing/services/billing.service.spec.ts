import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { BillingService } from './billing.service';
import { UsageService } from './usage.service';
import { Subscription } from '../entities/subscription.entity';
import { Payment } from '../entities/payment.entity';
import { RAZORPAY_SERVICE } from '../../Integration/interfaces/razorpay.interface';

describe('BillingService', () => {
  let service: BillingService;
  const mockBusinessId = 'b0000000-0000-0000-0000-000000000001';

  const mockRazorpayService = {
    getKeyId: jest.fn().mockReturnValue('rzp_test_mock'),
    createOrder: jest.fn().mockResolvedValue({
      id: 'order_test_123',
      amount: 149900,
      currency: 'INR',
      receipt: 'rcpt_123',
      status: 'created',
      key_id: 'rzp_test_mock',
    }),
    verifyPaymentSignature: jest.fn(),
    verifyWebhookSignature: jest.fn(),
  };

  const mockUsageService = {
    GetUsageStats: jest.fn().mockResolvedValue({
      period_month: '2026-10',
      whatsapp_requests_sent: 10,
      whatsapp_requests_limit: 50,
      whatsapp_requests_remaining: 40,
      widgets_count: 1,
      widgets_limit: 1,
      testimonials_count: 5,
      testimonials_limit: 20,
    }),
    SyncUsageLimitForPlan: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: RAZORPAY_SERVICE,
          useValue: mockRazorpayService,
        },
        {
          provide: UsageService,
          useValue: mockUsageService,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
    jest.spyOn(Payment.prototype, 'save').mockResolvedValue({} as any);
    jest.spyOn(Payment, 'findOne').mockResolvedValue(null);
  });

  describe('GetOrCreateSubscription', () => {
    it('should return existing subscription if found', async () => {
      const existing = {
        id: 'sub-1',
        business_id: mockBusinessId,
        plan: 'GROWTH',
        subscription_status: 'ACTIVE',
      } as any;
      jest.spyOn(Subscription, 'findOne').mockResolvedValue(existing);

      const result = await service.GetOrCreateSubscription(mockBusinessId);
      expect(result.plan).toBe('GROWTH');
    });

    it('should create default FREE subscription if none found', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue(null);
      jest.spyOn(Subscription.prototype, 'save').mockResolvedValue({} as any);

      const result = await service.GetOrCreateSubscription(mockBusinessId);
      expect(result.plan).toBe('FREE');
      expect(result.subscription_status).toBe('ACTIVE');
    });
  });

  describe('CreateCheckoutOrder', () => {
    it('should create Razorpay order with correct paise amount for Growth monthly', async () => {
      const result = await service.CreateCheckoutOrder(mockBusinessId, {
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
      });

      expect(mockRazorpayService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 149900,
          currency: 'INR',
        }),
      );
      expect(result.orderId).toBe('order_test_123');
      expect(result.plan).toBe('GROWTH');
    });

    it('should throw error when attempting to checkout FREE plan', async () => {
      await expect(
        service.CreateCheckoutOrder(mockBusinessId, {
          plan: 'FREE' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('VerifyPayment', () => {
    it('should throw BadRequestException if signature is invalid', async () => {
      mockRazorpayService.verifyPaymentSignature.mockReturnValue(false);

      await expect(
        service.VerifyPayment(mockBusinessId, {
          razorpay_order_id: 'order_1',
          razorpay_payment_id: 'pay_1',
          razorpay_signature: 'invalid_sig',
          plan: 'GROWTH',
          billing_cycle: 'MONTHLY',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upgrade subscription and sync usage limits when signature is valid', async () => {
      mockRazorpayService.verifyPaymentSignature.mockReturnValue(true);

      const mockSub = {
        business_id: mockBusinessId,
        plan: 'FREE',
        save: jest.fn().mockResolvedValue(true),
      } as any;
      jest.spyOn(Subscription, 'findOne').mockResolvedValue(mockSub);

      const result = await service.VerifyPayment(mockBusinessId, {
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'valid_sig',
        plan: 'GROWTH',
        billing_cycle: 'MONTHLY',
      });

      expect(result.success).toBe(true);
      expect(mockSub.plan).toBe('GROWTH');
      expect(mockUsageService.SyncUsageLimitForPlan).toHaveBeenCalledWith(
        mockBusinessId,
        'GROWTH',
      );
    });
  });

  describe('CancelSubscription', () => {
    it('should mark subscription to cancel at period end', async () => {
      const mockSub = {
        business_id: mockBusinessId,
        plan: 'GROWTH',
        subscription_status: 'ACTIVE',
        current_period_end: new Date(),
        cancel_at_period_end: false,
        save: jest.fn().mockResolvedValue(true),
      } as any;
      jest.spyOn(Subscription, 'findOne').mockResolvedValue(mockSub);

      const result = await service.CancelSubscription(mockBusinessId);
      expect(result.success).toBe(true);
      expect(mockSub.cancel_at_period_end).toBe(true);
      expect(mockSub.save).toHaveBeenCalled();
    });
  });
});
