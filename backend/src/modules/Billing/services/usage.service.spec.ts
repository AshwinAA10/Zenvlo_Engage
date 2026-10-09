import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { UsageService } from './usage.service';
import { Usage } from '../entities/usage.entity';
import { Subscription } from '../entities/subscription.entity';
import { Widget } from '../../Widget/entities/widget.entity';
import { Testimonial } from '../../Testimonial/entities/testimonial.entity';
import { PLAN_CONFIGS } from '../models/billing.dto';

describe('UsageService', () => {
  let service: UsageService;
  const mockBusinessId = 'b0000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsageService>(UsageService);
    jest.clearAllMocks();
  });

  describe('CheckCanSendWhatsAppRequest', () => {
    it('should allow sending when usage is within limits', async () => {
      const mockUsage = {
        business_id: mockBusinessId,
        period_month: service.getCurrentPeriodMonth(),
        whatsapp_requests_sent: 10,
        whatsapp_requests_limit: 50,
        save: jest.fn(),
      } as any;

      jest.spyOn(Usage, 'findOne').mockResolvedValue(mockUsage);

      const result = await service.CheckCanSendWhatsAppRequest(mockBusinessId);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when limit is reached', async () => {
      const mockUsage = {
        business_id: mockBusinessId,
        period_month: service.getCurrentPeriodMonth(),
        whatsapp_requests_sent: 50,
        whatsapp_requests_limit: 50,
        save: jest.fn(),
      } as any;

      jest.spyOn(Usage, 'findOne').mockResolvedValue(mockUsage);

      await expect(
        service.CheckCanSendWhatsAppRequest(mockBusinessId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('IncrementWhatsAppUsage', () => {
    it('should increment requests sent count and save', async () => {
      const mockUsage = {
        business_id: mockBusinessId,
        period_month: service.getCurrentPeriodMonth(),
        whatsapp_requests_sent: 5,
        whatsapp_requests_limit: 50,
        save: jest.fn().mockResolvedValue(true),
      } as any;

      jest.spyOn(Usage, 'findOne').mockResolvedValue(mockUsage);

      const updated = await service.IncrementWhatsAppUsage(mockBusinessId, 2);
      expect(updated.whatsapp_requests_sent).toBe(7);
      expect(mockUsage.save).toHaveBeenCalled();
    });
  });

  describe('CheckCanCreateWidget', () => {
    it('should allow creating widget when under Free tier limit', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'FREE',
      } as any);
      jest.spyOn(Widget, 'count').mockResolvedValue(0);

      const result = await service.CheckCanCreateWidget(mockBusinessId);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when Free tier exceeds 1 widget', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'FREE',
      } as any);
      jest.spyOn(Widget, 'count').mockResolvedValue(1);

      await expect(
        service.CheckCanCreateWidget(mockBusinessId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow unlimited widgets on Growth plan', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'GROWTH',
      } as any);
      jest.spyOn(Widget, 'count').mockResolvedValue(5);

      const result = await service.CheckCanCreateWidget(mockBusinessId);
      expect(result).toBe(true);
    });
  });

  describe('CheckCanCreateTestimonial (Unit Tests for Quota Enforcement)', () => {
    it('Free plan limit resolves to 20 from authoritative PLAN_CONFIGS', () => {
      expect(PLAN_CONFIGS.FREE.features.testimonials_limit).toBe(20);
      expect(PLAN_CONFIGS.GROWTH.features.testimonials_limit).toBeNull();
      expect(PLAN_CONFIGS.ENTERPRISE.features.testimonials_limit).toBeNull();
    });

    it('Usage below limit is allowed (0 testimonials)', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'FREE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(0);

      const result = await service.CheckCanCreateTestimonial(mockBusinessId);
      expect(result).toBe(true);
    });

    it('Usage below limit is allowed (19 testimonials)', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'FREE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(19);

      const result = await service.CheckCanCreateTestimonial(mockBusinessId);
      expect(result).toBe(true);
    });

    it('Usage exactly at 20 is rejected with ForbiddenException (HTTP 403)', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'FREE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(20);

      let thrownError: any;
      try {
        await service.CheckCanCreateTestimonial(mockBusinessId);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ForbiddenException);
      expect(thrownError.getStatus()).toBe(403);
      expect(thrownError.message).toBe(
        'You have reached the maximum allowed testimonials (20) for the FREE plan. Upgrade to Growth for unlimited testimonials.',
      );
    });

    it('Usage above 20 is rejected', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'FREE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(25);

      await expect(
        service.CheckCanCreateTestimonial(mockBusinessId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Correct tenant is evaluated in database queries', async () => {
      const specificTenantId = 'tenant-uuid-check-1234';
      const findSubscriptionSpy = jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'FREE',
      } as any);
      const countTestimonialSpy = jest.spyOn(Testimonial, 'count').mockResolvedValue(5);

      await service.CheckCanCreateTestimonial(specificTenantId);

      expect(findSubscriptionSpy).toHaveBeenCalledWith({
        where: { business_id: specificTenantId, subscription_status: 'ACTIVE' },
      });
      expect(countTestimonialSpy).toHaveBeenCalledWith({
        where: { business_id: specificTenantId },
      });
    });

    it('Paid plans (GROWTH) are not incorrectly restricted', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'GROWTH',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(50);

      const result = await service.CheckCanCreateTestimonial(mockBusinessId);
      expect(result).toBe(true);
    });

    it('Paid plans (ENTERPRISE) are not incorrectly restricted', async () => {
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'ENTERPRISE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(200);

      const result = await service.CheckCanCreateTestimonial(mockBusinessId);
      expect(result).toBe(true);
    });
  });

  describe('GetUsageStats', () => {
    it('should return aggregated usage metrics', async () => {
      jest.spyOn(Usage, 'findOne').mockResolvedValue({
        period_month: '2026-10',
        whatsapp_requests_sent: 15,
        whatsapp_requests_limit: 50,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        plan: 'FREE',
      } as any);
      jest.spyOn(Widget, 'count').mockResolvedValue(1);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(8);

      const stats = await service.GetUsageStats(mockBusinessId);
      expect(stats.whatsapp_requests_sent).toBe(15);
      expect(stats.whatsapp_requests_limit).toBe(50);
      expect(stats.whatsapp_requests_remaining).toBe(35);
      expect(stats.widgets_count).toBe(1);
      expect(stats.testimonials_count).toBe(8);
    });
  });
});
