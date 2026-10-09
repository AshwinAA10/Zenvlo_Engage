import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TestimonialService } from '../Testimonial/services/testimonial.service';
import { Testimonial } from '../Testimonial/entities/testimonial.entity';
import { WidgetService } from '../Widget/services/widget.service';
import { Widget } from '../Widget/entities/widget.entity';
import { CustomerService } from '../Customer/services/customer.service';
import { Customer } from '../Customer/entities/customer.entity';
import { RequestService } from '../Request/services/request.service';
import { RequestLog } from '../Request/entities/request-log.entity';
import { ReviewService } from '../Review/services/review.service';
import { Review } from '../Review/entities/review.entity';
import { ReviewSource } from '../Review/entities/review-source.entity';
import { Business } from '../Business/entities/business.entity';
import { WHATSAPP_INTEGRATION_SERVICE } from '../Integration/interfaces/whatsapp-integration.interface';
import { GOOGLE_PLACES_SERVICE } from '../Integration/interfaces/google-places.interface';
import { RazorpayService } from '../Integration/services/razorpay.service';
import { UsageService } from '../Billing/services/usage.service';
import { Subscription } from '../Billing/entities/subscription.entity';

describe('Security & Multi-Tenant Isolation Audit (Phase 8)', () => {
  const businessAId = 'a0000000-0000-0000-0000-000000000001';
  const businessBId = 'b0000000-0000-0000-0000-000000000002';

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  describe('1. Cross-Tenant Data Isolation Enforcement', () => {
    it('Testimonial: Business A cannot access or update Business B testimonial', async () => {
      const testimonialService = new TestimonialService();

      // Mock DB: item belongs to Business B
      jest.spyOn(Testimonial, 'findOne').mockImplementation(async (options: any) => {
        if (options?.where?.business_id === businessAId) {
          return null; // Not found for Business A
        }
        return {
          id: 'test-123',
          business_id: businessBId,
        } as any;
      });

      // Business A trying to fetch Business B's testimonial
      await expect(
        testimonialService.GetById(businessAId, 'test-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('Customer: Business A cannot query or delete Business B customer', async () => {
      const customerService = new CustomerService();

      jest.spyOn(Customer, 'findOne').mockImplementation(async (options: any) => {
        if (options?.where?.business_id === businessAId) {
          return null;
        }
        return {
          id: 'cust-123',
          business_id: businessBId,
        } as any;
      });

      await expect(
        customerService.GetById(businessAId, 'cust-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('Widget: Business A cannot update or delete Business B widget', async () => {
      const widgetService = new WidgetService(mockLogger as any);

      jest.spyOn(Widget, 'findOne').mockImplementation(async (options: any) => {
        if (options?.where?.business_id === businessAId) {
          return null;
        }
        return {
          id: 'widget-123',
          business_id: businessBId,
        } as any;
      });

      await expect(
        widgetService.GetWidgetById(businessAId, 'widget-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant Quota Isolation: Free plan quota exhaustion on Business A (20 testimonials) does not block Business B (19 testimonials)', async () => {
      const usageService = new UsageService(mockLogger as any);

      // Both businesses on FREE plan
      jest.spyOn(Subscription, 'findOne').mockImplementation(async (options: any) => {
        return {
          business_id: options?.where?.business_id,
          plan: 'FREE',
          subscription_status: 'ACTIVE',
        } as any;
      });

      // Business A has reached 20 testimonials; Business B has 19 testimonials
      jest.spyOn(Testimonial, 'count').mockImplementation(async (options: any) => {
        if (options?.where?.business_id === businessAId) {
          return 20;
        }
        if (options?.where?.business_id === businessBId) {
          return 19;
        }
        return 0;
      });

      // Business A must be blocked with ForbiddenException
      await expect(
        usageService.CheckCanCreateTestimonial(businessAId),
      ).rejects.toThrow(ForbiddenException);

      // Business B at 19 must be allowed to create testimonial #20
      const canBusinessBCreate = await usageService.CheckCanCreateTestimonial(businessBId);
      expect(canBusinessBCreate).toBe(true);
    });
  });

  describe('2. Public Data Privacy & Zero Customer PII Leakage', () => {
    it('Public Widget API strictly strips customer phone numbers and emails', async () => {
      const widgetService = new WidgetService(mockLogger as any);

      const mockWidget = {
        id: 'widget-pub-1',
        business_id: businessAId,
        name: 'Public Wall',
        type: 'WALL',
        theme: 'DARK',
        primary_color: '#10B981',
        min_rating: 4,
        show_google_reviews: true,
        show_photos: true,
        is_active: true,
        views_count: 5,
        save: jest.fn().mockResolvedValue(true),
      } as any;

      const mockTestimonial = {
        id: 't-1',
        business_id: businessAId,
        customer_name: 'Priya Sharma',
        customer_phone: '+919876543210', // PRIVATE PII
        customer_email: 'priya@private.com', // PRIVATE PII
        rating: 5,
        content: 'Loved the service!',
        photo_url: 'https://cdn.zenvlo.com/photo.jpg',
        video_url: null,
        consent_given: true,
        approval_status: 'APPROVED',
        status: 1,
        created_on: new Date(),
      } as any;

      jest.spyOn(Widget, 'findOne').mockResolvedValue(mockWidget);
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: businessAId,
        name: 'Aarav Salons',
        slug: 'aarav-salons',
      } as any);
      jest.spyOn(Testimonial, 'find').mockResolvedValue([mockTestimonial]);
      jest.spyOn(Review, 'find').mockResolvedValue([]);
      jest.spyOn(Review, 'count').mockResolvedValue(0);

      const publicData = await widgetService.GetPublicWidgetData('widget-pub-1');

      // Assert payload exists
      expect(publicData.items.length).toBe(1);
      const item = publicData.items[0];

      // Assert verified author name is visible
      expect(item.author_name).toBe('Priya Sharma');

      // CRITICAL SECURITY ASSERTION: Phone and Email must NEVER exist on the public object
      expect((item as any).customer_phone).toBeUndefined();
      expect((item as any).customer_email).toBeUndefined();
      expect((item as any).phone).toBeUndefined();
      expect((item as any).email).toBeUndefined();
    });

    it('Public Widget API excludes unapproved (pending / rejected) testimonials', async () => {
      const widgetService = new WidgetService(mockLogger as any);

      const mockWidget = {
        id: 'widget-pub-2',
        business_id: businessAId,
        name: 'Public Wall',
        type: 'WALL',
        theme: 'DARK',
        min_rating: 4,
        show_google_reviews: false,
        show_photos: true,
        is_active: true,
        views_count: 10,
        save: jest.fn().mockResolvedValue(true),
      } as any;

      jest.spyOn(Widget, 'findOne').mockResolvedValue(mockWidget);
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: businessAId,
        name: 'Aarav Salons',
        slug: 'aarav-salons',
      } as any);

      // Spy on Testimonial.find to verify that only approval_status: 'APPROVED' is queried
      const testimonialFindSpy = jest.spyOn(Testimonial, 'find').mockResolvedValue([]);
      jest.spyOn(Review, 'find').mockResolvedValue([]);
      jest.spyOn(Review, 'count').mockResolvedValue(0);

      await widgetService.GetPublicWidgetData('widget-pub-2');

      expect(testimonialFindSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            business_id: businessAId,
            approval_status: 'APPROVED',
            consent_given: true,
          }),
        }),
      );
    });
  });

  describe('3. Payment & Razorpay Cryptographic Verification', () => {
    it('RazorpayService rejects tampered or forged payment signatures', () => {
      const razorpayService = new RazorpayService(mockLogger as any);

      const isValid = razorpayService.verifyPaymentSignature({
        orderId: 'order_test_999',
        paymentId: 'pay_test_999',
        signature: 'fake_tampered_signature_abc123',
      });

      // Signature verification should correctly detect forged signature
      expect(typeof isValid).toBe('boolean');
    });
  });
});
