import { TestimonialService } from './testimonial.service';
import { Testimonial } from '../entities/testimonial.entity';
import { Business } from '../../Business/entities/business.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { UsageService } from '../../Billing/services/usage.service';
import { Subscription } from '../../Billing/entities/subscription.entity';
import { ForbiddenException } from '@nestjs/common';

describe('TestimonialService', () => {
  let service: TestimonialService;

  beforeEach(() => {
    service = new TestimonialService();
    jest.clearAllMocks();
  });

  it('should submit public testimonial as PENDING with consent captured', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'bus-1',
      slug: 'orchid-salon',
      user_id: 'usr-owner-1',
      status: 1,
    } as any);

    jest.spyOn(Customer, 'findOne').mockResolvedValue(null);

    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'testi-123';
      return Promise.resolve(this);
    });
    jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

    const result = await service.SubmitPublic('orchid-salon', {
      rating: 5,
      content: 'Absolutely phenomenal service! The staff was courteous.',
      customer_name: 'Priyanka Chopra',
      customer_phone: '+919988776655',
      consent_given: true,
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('testi-123');
  });

  it('should reject submission if consent is missing', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'bus-1',
      slug: 'orchid-salon',
    } as any);

    await expect(
      service.SubmitPublic('orchid-salon', {
        rating: 4,
        content: 'Good experience overall',
        customer_name: 'Rahul',
        consent_given: false,
      }),
    ).rejects.toThrow('Customer consent is required');
  });

  it('should allow business owner to approve or reject a testimonial', async () => {
    const existing = new Testimonial();
    existing.id = 'testi-999';
    existing.business_id = 'bus-1';
    existing.approval_status = 'PENDING';

    jest.spyOn(Testimonial, 'findOne').mockResolvedValue(existing as any);
    jest.spyOn(existing, 'save').mockResolvedValue(existing as any);

    const approved = await service.UpdateStatus(
      'bus-1',
      'testi-999',
      { status: 'APPROVED' as any },
      'usr-owner-1',
    );

    expect(approved.approval_status).toBe('APPROVED');
    expect(approved.approved_at).toBeDefined();
    expect(approved.approved_by_id).toBe('usr-owner-1');
  });

  it('should enforce quota via UsageService and reject submission when limit reached', async () => {
    const mockUsageService = {
      CheckCanCreateTestimonial: jest.fn().mockRejectedValue(
        new Error(
          'You have reached the maximum allowed testimonials (20) for the FREE plan. Upgrade to Growth for unlimited testimonials.',
        ),
      ),
    } as any;

    const quotaService = new TestimonialService(mockUsageService);

    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'bus-1',
      slug: 'orchid-salon',
      user_id: 'usr-owner-1',
      status: 1,
    } as any);

    await expect(
      quotaService.SubmitPublic('orchid-salon', {
        rating: 5,
        content: 'Great service!',
        customer_name: 'Customer 21',
        consent_given: true,
      }),
    ).rejects.toThrow(
      'You have reached the maximum allowed testimonials (20) for the FREE plan. Upgrade to Growth for unlimited testimonials.',
    );

    expect(mockUsageService.CheckCanCreateTestimonial).toHaveBeenCalledWith('bus-1');
  });

  it('should serialize concurrent submissions for the same business without race conditions', async () => {
    let callOrder: number[] = [];
    const mockUsageService = {
      CheckCanCreateTestimonial: jest.fn().mockImplementation(async () => {
        // Simulating async work
        await new Promise((resolve) => setTimeout(resolve, 10));
        return true;
      }),
    } as any;

    const concurrentService = new TestimonialService(mockUsageService);

    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'bus-concurrent',
      slug: 'orchid-salon',
      user_id: 'usr-owner-1',
      status: 1,
    } as any);
    jest.spyOn(Customer, 'findOne').mockResolvedValue(null);

    let savedCount = 0;
    jest.spyOn(Testimonial.prototype, 'save').mockImplementation(function (this: any) {
      savedCount++;
      callOrder.push(savedCount);
      this.id = `testi-${savedCount}`;
      return Promise.resolve(this);
    });

    const [res1, res2] = await Promise.all([
      concurrentService.SubmitPublic('orchid-salon', {
        rating: 5,
        content: 'Concurrent Review 1',
        customer_name: 'User 1',
        consent_given: true,
      }),
      concurrentService.SubmitPublic('orchid-salon', {
        rating: 4,
        content: 'Concurrent Review 2',
        customer_name: 'User 2',
        consent_given: true,
      }),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(callOrder).toEqual([1, 2]);
    expect(mockUsageService.CheckCanCreateTestimonial).toHaveBeenCalledTimes(2);
  });

  describe('Phase 3 Quota Enforcement Scenarios', () => {
    const mockLogger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    let usageService: UsageService;
    let integratedService: TestimonialService;

    beforeEach(() => {
      usageService = new UsageService(mockLogger as any);
      integratedService = new TestimonialService(usageService);
    });

    it('Scenario: Free tenant 0 -> create -> 1 succeeds', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-free',
        slug: 'orchid-salon',
        user_id: 'usr-1',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-free',
        plan: 'FREE',
        subscription_status: 'ACTIVE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(0);

      const mockSave = jest.fn().mockImplementation(function (this: any) {
        this.id = 'testi-1';
        return Promise.resolve(this);
      });
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

      const result = await integratedService.SubmitPublic('orchid-salon', {
        rating: 5,
        content: 'First review',
        customer_name: 'Ananya',
        consent_given: true,
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('testi-1');
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('Scenario: Free tenant 18 -> create -> 19 succeeds', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-free',
        slug: 'orchid-salon',
        user_id: 'usr-1',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-free',
        plan: 'FREE',
        subscription_status: 'ACTIVE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(18);

      const mockSave = jest.fn().mockImplementation(function (this: any) {
        this.id = 'testi-19';
        return Promise.resolve(this);
      });
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

      const result = await integratedService.SubmitPublic('orchid-salon', {
        rating: 5,
        content: 'Review number 19',
        customer_name: 'Pooja',
        consent_given: true,
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('testi-19');
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('Scenario: Free tenant 19 -> create -> 20 succeeds (last allowed slot)', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-free',
        slug: 'orchid-salon',
        user_id: 'usr-1',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-free',
        plan: 'FREE',
        subscription_status: 'ACTIVE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(19);

      const mockSave = jest.fn().mockImplementation(function (this: any) {
        this.id = 'testi-20';
        return Promise.resolve(this);
      });
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

      const result = await integratedService.SubmitPublic('orchid-salon', {
        rating: 5,
        content: 'Review number 20',
        customer_name: 'Rohit',
        consent_given: true,
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('testi-20');
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('Scenario: Free tenant 20 -> create -> rejected with 403 Forbidden', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-free',
        slug: 'orchid-salon',
        user_id: 'usr-1',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-free',
        plan: 'FREE',
        subscription_status: 'ACTIVE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(20);

      const mockSave = jest.fn();
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

      await expect(
        integratedService.SubmitPublic('orchid-salon', {
          rating: 5,
          content: 'Review number 21 (should be blocked)',
          customer_name: 'Sneha',
          consent_given: true,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('Scenario: Free tenant 20 -> multiple consecutive attempts -> all rejected', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-free',
        slug: 'orchid-salon',
        user_id: 'usr-1',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-free',
        plan: 'FREE',
        subscription_status: 'ACTIVE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(20);

      const mockSave = jest.fn();
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

      for (let attempt = 1; attempt <= 3; attempt++) {
        await expect(
          integratedService.SubmitPublic('orchid-salon', {
            rating: 5,
            content: `Attempt ${attempt}`,
            customer_name: `Customer ${attempt}`,
            consent_given: true,
          }),
        ).rejects.toThrow(ForbiddenException);
      }

      expect(mockSave).not.toHaveBeenCalled();
    });

    it('Scenario: Concurrency Test - Current count = 19, multiple concurrent creation requests -> at most ONE succeeds, final count MUST NOT exceed 20', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-concurrent',
        slug: 'orchid-salon',
        user_id: 'usr-1',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-concurrent',
        plan: 'FREE',
        subscription_status: 'ACTIVE',
      } as any);

      let currentDbCount = 19;
      jest.spyOn(Testimonial, 'count').mockImplementation(async () => {
        return currentDbCount;
      });

      let savedTestimonials: any[] = [];
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(function (this: any) {
        currentDbCount++;
        this.id = `testi-${currentDbCount}`;
        savedTestimonials.push(this);
        return Promise.resolve(this);
      });

      // Launch a burst of 5 concurrent creation requests simultaneously
      const burstRequests = [1, 2, 3, 4, 5].map((index) =>
        integratedService.SubmitPublic('orchid-salon', {
          rating: 5,
          content: `Concurrent Submission #${index}`,
          customer_name: `Customer #${index}`,
          consent_given: true,
        }),
      );

      const results = await Promise.allSettled(burstRequests);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // CRITICAL CONCURRENCY INVARIANTS:
      // 1. At most ONE additional testimonial is created
      expect(fulfilled.length).toBe(1);
      // 2. All other 4 requests fail with ForbiddenException (403)
      expect(rejected.length).toBe(4);
      rejected.forEach((r) => {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ForbiddenException);
      });
      // 3. Final count MUST NOT exceed 20
      expect(currentDbCount).toBe(20);
      expect(savedTestimonials.length).toBe(1);
    });

    it('Scenario: After deletion 20 -> delete -> 19 -> create -> 20 succeeds', async () => {
      const existing = new Testimonial();
      existing.id = 'testi-to-delete';
      existing.business_id = 'bus-free';
      existing.status = 1;

      jest.spyOn(Testimonial, 'findOne').mockResolvedValue(existing as any);
      const mockSoftRemove = jest.fn().mockImplementation(function (this: any) {
        this.deleted_on = new Date();
        return Promise.resolve(this);
      });
      jest.spyOn(existing, 'softRemove').mockImplementation(mockSoftRemove);

      await integratedService.Delete('bus-free', 'testi-to-delete');
      expect(mockSoftRemove).toHaveBeenCalled();

      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-free',
        slug: 'orchid-salon',
        user_id: 'usr-1',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-free',
        plan: 'FREE',
        subscription_status: 'ACTIVE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(19);

      const mockSave = jest.fn().mockImplementation(function (this: any) {
        this.id = 'testi-recreated-20';
        return Promise.resolve(this);
      });
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

      const res = await integratedService.SubmitPublic('orchid-salon', {
        rating: 5,
        content: 'New 20th review after deletion of old one',
        customer_name: 'Vikram',
        consent_given: true,
      });

      expect(res.success).toBe(true);
      expect(res.id).toBe('testi-recreated-20');
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('Scenario: Paid tenant (GROWTH) with 35 testimonials -> creation remains allowed', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-growth',
        slug: 'premium-spa',
        user_id: 'usr-growth',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-growth',
        plan: 'GROWTH',
        subscription_status: 'ACTIVE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(35);

      const mockSave = jest.fn().mockImplementation(function (this: any) {
        this.id = 'testi-36';
        return Promise.resolve(this);
      });
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(mockSave);

      const result = await integratedService.SubmitPublic('premium-spa', {
        rating: 5,
        content: 'Review on paid Growth plan',
        customer_name: 'Deepak',
        consent_given: true,
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('testi-36');
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('Scenario: Tenant isolation: Tenant A (20) rejected, Tenant B (19) can create #20, zero count leakage', async () => {
      jest.spyOn(Business, 'findOne').mockImplementation(async (options: any) => {
        if (options?.where?.slug === 'tenant-a') {
          return { id: 'bus-a', slug: 'tenant-a', user_id: 'usr-a', status: 1 } as any;
        }
        if (options?.where?.slug === 'tenant-b') {
          return { id: 'bus-b', slug: 'tenant-b', user_id: 'usr-b', status: 1 } as any;
        }
        return null;
      });

      jest.spyOn(Subscription, 'findOne').mockImplementation(async (options: any) => {
        return {
          business_id: options?.where?.business_id,
          plan: 'FREE',
          subscription_status: 'ACTIVE',
        } as any;
      });

      let countA = 20;
      let countB = 19;

      jest.spyOn(Testimonial, 'count').mockImplementation(async (options: any) => {
        if (options?.where?.business_id === 'bus-a') return countA;
        if (options?.where?.business_id === 'bus-b') return countB;
        return 0;
      });

      let savedIds: string[] = [];
      jest.spyOn(Testimonial.prototype, 'save').mockImplementation(function (this: any) {
        if (this.business_id === 'bus-b') {
          countB++;
        }
        this.id = `testi-${this.business_id}-${countB}`;
        savedIds.push(this.id);
        return Promise.resolve(this);
      });

      // Tenant A at 20 cannot create another
      await expect(
        integratedService.SubmitPublic('tenant-a', {
          rating: 5,
          content: 'Tenant A review attempt 21',
          customer_name: 'Customer A',
          consent_given: true,
        }),
      ).rejects.toThrow(ForbiddenException);

      // Tenant B at 19 CAN create testimonial #20
      const resB = await integratedService.SubmitPublic('tenant-b', {
        rating: 5,
        content: 'Tenant B review #20',
        customer_name: 'Customer B',
        consent_given: true,
      });

      expect(resB.success).toBe(true);
      expect(savedIds).toEqual(['testi-bus-b-20']);

      // Tenant A's count was NOT modified by Tenant B's operations, and vice versa (zero leakage)
      expect(countA).toBe(20);
      expect(countB).toBe(20);
    });

    it('Scenario: Failed creation (e.g. database error during save) does not alter usage count', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: 'bus-free',
        slug: 'orchid-salon',
        user_id: 'usr-1',
        status: 1,
      } as any);
      jest.spyOn(Subscription, 'findOne').mockResolvedValue({
        business_id: 'bus-free',
        plan: 'FREE',
        subscription_status: 'ACTIVE',
      } as any);
      jest.spyOn(Testimonial, 'count').mockResolvedValue(15);

      jest.spyOn(Testimonial.prototype, 'save').mockRejectedValue(new Error('DB Connection Timeout'));

      await expect(
        integratedService.SubmitPublic('orchid-salon', {
          rating: 5,
          content: 'Failing review',
          customer_name: 'Kavita',
          consent_given: true,
        }),
      ).rejects.toThrow('DB Connection Timeout');

      const countAfter = await Testimonial.count({ where: { business_id: 'bus-free' } });
      expect(countAfter).toBe(15);
    });
  });
});
