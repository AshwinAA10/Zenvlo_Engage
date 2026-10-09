import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TestimonialController } from './testimonial.controller';
import { TestimonialService } from '../services/testimonial.service';
import { BusinessService } from '../../Business/services/business.service';
import { ApprovalStatusEnum } from '../models/testimonial.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

describe('TestimonialController (API & Integration)', () => {
  let controller: TestimonialController;
  let testimonialService: jest.Mocked<TestimonialService>;
  let businessService: jest.Mocked<BusinessService>;

  beforeEach(async () => {
    const mockTestimonialService = {
      SubmitPublic: jest.fn(),
      GetAll: jest.fn(),
      GetById: jest.fn(),
      UpdateStatus: jest.fn(),
      Delete: jest.fn(),
    };

    const mockBusinessService = {
      GetBySlug: jest.fn(),
      GetById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestimonialController],
      providers: [
        {
          provide: TestimonialService,
          useValue: mockTestimonialService,
        },
        {
          provide: BusinessService,
          useValue: mockBusinessService,
        },
        {
          provide: ClsService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            isActive: jest.fn().mockReturnValue(true),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TestimonialController>(TestimonialController);
    testimonialService = module.get(TestimonialService);
    businessService = module.get(BusinessService);
  });

  describe('SubmitPublic (POST /testimonials/public/:slug)', () => {
    const validDto = {
      rating: 5,
      content: 'Fantastic service!',
      customer_name: 'Pooja Hegde',
      consent_given: true,
    };

    it('should return HTTP 201 Created and response payload when quota is available', async () => {
      testimonialService.SubmitPublic.mockResolvedValueOnce({
        success: true,
        message: 'Your review has been submitted for review. Thank you!',
        id: 'testi-new-1',
      });

      const result = await controller.SubmitPublic('spa-luxe', validDto);

      expect(testimonialService.SubmitPublic).toHaveBeenCalledWith('spa-luxe', validDto);
      expect(result).toEqual({
        success: true,
        message: 'Your review has been submitted for review. Thank you!',
        id: 'testi-new-1',
      });
    });

    it('should throw HTTP 403 Forbidden when Free plan testimonial limit of 20 is reached', async () => {
      testimonialService.SubmitPublic.mockRejectedValue(
        new ForbiddenException(
          'You have reached the maximum allowed testimonials (20) for the FREE plan. Upgrade to Growth for unlimited testimonials.',
        ),
      );

      await expect(
        controller.SubmitPublic('spa-luxe', validDto),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.SubmitPublic('spa-luxe', validDto),
      ).rejects.toThrow(
        'You have reached the maximum allowed testimonials (20) for the FREE plan. Upgrade to Growth for unlimited testimonials.',
      );
    });

    it('should throw HTTP 404 when public slug does not match any business', async () => {
      testimonialService.SubmitPublic.mockRejectedValueOnce(
        new NotFoundException("Business with address 'nonexistent-spa' not found"),
      );

      await expect(
        controller.SubmitPublic('nonexistent-spa', validDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Public Form Info (GET /testimonials/public/:slug/info)', () => {
    it('should return sanitized business info without private owner data', async () => {
      businessService.GetBySlug.mockResolvedValueOnce({
        id: 'bus-123',
        name: 'Spa Luxe',
        slug: 'spa-luxe',
        category: 'Wellness',
        logo_url: 'https://example.com/logo.png',
        location: 'Mumbai, India',
        user_id: 'usr-private-id',
      } as any);

      const info = await controller.GetPublicFormInfo('spa-luxe');

      expect(info).toEqual({
        id: 'bus-123',
        name: 'Spa Luxe',
        slug: 'spa-luxe',
        category: 'Wellness',
        logo_url: 'https://example.com/logo.png',
        location: 'Mumbai, India',
      });
      expect((info as any).user_id).toBeUndefined();
    });
  });

  describe('Authenticated Tenant-Isolated Endpoints', () => {
    const mockReq = {
      user: {
        id: 'usr-owner-1',
        sub: 'usr-owner-1',
        business_id: 'bus-tenant-1',
      },
    };

    it('GetAll should pass businessId from authenticated user session', async () => {
      testimonialService.GetAll.mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        counts: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          averageRating: 5.0,
        },
      });

      const res = await controller.GetAll(mockReq, { status: 'ALL' });
      expect(testimonialService.GetAll).toHaveBeenCalledWith('bus-tenant-1', { status: 'ALL' });
      expect(res.total).toBe(0);
    });

    it('GetById should strictly scope query to authenticated user businessId', async () => {
      const mockTestimonial = {
        id: 't-123',
        business_id: 'bus-tenant-1',
        customer_name: 'Rahul',
      } as any;
      testimonialService.GetById.mockResolvedValueOnce(mockTestimonial);

      const res = await controller.GetById(mockReq, 't-123');
      expect(testimonialService.GetById).toHaveBeenCalledWith('bus-tenant-1', 't-123');
      expect(res).toEqual(mockTestimonial);
    });

    it('UpdateStatus should pass businessId, id, dto, and userId', async () => {
      const updated = {
        id: 't-123',
        approval_status: 'APPROVED',
      } as any;
      testimonialService.UpdateStatus.mockResolvedValueOnce(updated);

      const dto = { status: ApprovalStatusEnum.APPROVED };
      const res = await controller.UpdateStatus(mockReq, 't-123', dto);

      expect(testimonialService.UpdateStatus).toHaveBeenCalledWith(
        'bus-tenant-1',
        't-123',
        dto,
        'usr-owner-1',
      );
      expect(res).toEqual(updated);
    });

    it('Delete should strictly scope deletion to authenticated user businessId', async () => {
      testimonialService.Delete.mockResolvedValueOnce(undefined);

      await controller.Delete(mockReq, 't-123');
      expect(testimonialService.Delete).toHaveBeenCalledWith('bus-tenant-1', 't-123');
    });
  });
});
