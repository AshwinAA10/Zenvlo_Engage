import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { RequestService } from './request.service';
import { RequestLog } from '../entities/request-log.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { Business } from '../../Business/entities/business.entity';
import {
  WHATSAPP_INTEGRATION_SERVICE,
  IWhatsAppIntegrationService,
} from '../../Integration/interfaces/whatsapp-integration.interface';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RequestService', () => {
  let service: RequestService;
  let whatsappService: IWhatsAppIntegrationService;

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockWhatsAppService: IWhatsAppIntegrationService = {
    SendTestimonialRequest: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'msg_test_123',
      status: 'PENDING_CONTRACT',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestService,
        { provide: PinoLogger, useValue: mockLogger },
        {
          provide: WHATSAPP_INTEGRATION_SERVICE,
          useValue: mockWhatsAppService,
        },
      ],
    }).compile();

    service = module.get<RequestService>(RequestService);
    whatsappService = module.get<IWhatsAppIntegrationService>(
      WHATSAPP_INTEGRATION_SERVICE,
    );
    jest.clearAllMocks();
  });

  it('should successfully send a single request for a valid customer', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'biz-1',
      name: 'Spa Luxe',
      slug: 'spa-luxe',
    } as any);

    const mockCustomer = {
      id: 'cust-1',
      business_id: 'biz-1',
      name: 'Ananya Roy',
      phone: '+919988776655',
      request_count: 0,
      last_request_sent_at: null,
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(Customer, 'findOne').mockResolvedValue(mockCustomer as any);

    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'log-1';
      return Promise.resolve(this);
    });
    jest.spyOn(RequestLog.prototype, 'save').mockImplementation(mockSave);

    const result = await service.SendSingleRequest('biz-1', {
      customer_id: 'cust-1',
      custom_message: 'Thanks for coming in!',
    });

    expect(result.customer_name).toBe('Ananya Roy');
    expect(result.customer_phone).toBe('+919988776655');
    expect(result.testimonial_url).toContain('/submit/spa-luxe');
    expect(result.delivery_status).toBe('PENDING_CONTRACT');
    expect(mockCustomer.request_count).toBe(1);
    expect(mockCustomer.last_request_sent_at).toBeDefined();
    expect(whatsappService.SendTestimonialRequest).toHaveBeenCalledTimes(1);
  });

  it('should reject request if customer belongs to another tenant/business', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'biz-1',
      name: 'Spa Luxe',
      slug: 'spa-luxe',
    } as any);

    // Customer belonging to biz-2 cannot be found for biz-1
    jest.spyOn(Customer, 'findOne').mockResolvedValue(null);

    await expect(
      service.SendSingleRequest('biz-1', {
        customer_id: 'foreign-customer-id',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject single request if customer name or phone is missing', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'biz-1',
      name: 'Spa Luxe',
      slug: 'spa-luxe',
    } as any);

    await expect(
      service.SendSingleRequest('biz-1', {
        customer_name: 'Solo Name',
        // customer_phone missing
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should compute delivery and feedback conversion stats correctly', async () => {
    jest.spyOn(RequestLog, 'find').mockResolvedValue([
      { id: '1', delivery_status: 'DELIVERED', testimonial_id: 't-1' },
      { id: '2', delivery_status: 'READ', testimonial_id: 't-2' },
      { id: '3', delivery_status: 'PENDING_CONTRACT', testimonial_id: null },
      { id: '4', delivery_status: 'FAILED', testimonial_id: null },
    ] as any);

    const stats = await service.GetRequestStats('biz-1');

    expect(stats.total_sent).toBe(4);
    expect(stats.delivered).toBe(2);
    expect(stats.read).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.pending_contract).toBe(1);
    expect(stats.feedback_received).toBe(2);
    expect(stats.feedback_conversion_rate).toBe(50); // 2 out of 4 = 50%
  });

  it('should process webhook status updates', async () => {
    const mockLog = {
      message_id: 'msg_xyz_789',
      delivery_status: 'SENT',
      delivered_at: null,
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

    const res = await service.HandleWebhook({
      message_id: 'msg_xyz_789',
      status: 'DELIVERED',
    });

    expect(res.updated).toBe(true);
    expect(mockLog.delivery_status).toBe('DELIVERED');
    expect(mockLog.delivered_at).toBeDefined();
    expect(mockLog.save).toHaveBeenCalled();
  });

  it('should handle provider failure securely without saving fake message IDs or incrementing quota', async () => {
    jest.spyOn(Business, 'findOne').mockResolvedValue({
      id: 'biz-1',
      name: 'Spa Luxe',
      slug: 'spa-luxe',
    } as any);

    const mockCustomer = {
      id: 'cust-1',
      business_id: 'biz-1',
      name: 'Ananya Roy',
      phone: '+919988776655',
      request_count: 0,
      last_request_sent_at: null,
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(Customer, 'findOne').mockResolvedValue(mockCustomer as any);

    const mockSave = jest.fn().mockImplementation(function (this: any) {
      this.id = 'log-failed-1';
      return Promise.resolve(this);
    });
    jest.spyOn(RequestLog.prototype, 'save').mockImplementation(mockSave);

    // Simulate provider failure
    (whatsappService.SendTestimonialRequest as jest.Mock).mockResolvedValueOnce({
      success: false,
      status: 'FAILED',
      errorMessage: 'Provider rate limit exceeded',
    });

    const result = await service.SendSingleRequest('biz-1', {
      customer_id: 'cust-1',
    });

    expect(result.delivery_status).toBe('FAILED');
    expect(result.message_id).toBeNull();
    expect(result.error_message).toBe('Provider rate limit exceeded');
    expect(result.delivered_at).toBeUndefined();
    // Customer quota/request count must NOT increment on failure
    expect(mockCustomer.request_count).toBe(0);
    expect(mockCustomer.save).not.toHaveBeenCalled();
  });

  describe('GetRequestAnalytics', () => {
    it('should compute comprehensive analytics with delivery success rate on known outcomes and continuous trend buckets', async () => {
      const startDate = '2026-10-01T00:00:00.000Z';
      const endDate = '2026-10-03T23:59:59.999Z';

      const currentCohort = [
        {
          id: 'log-1',
          delivery_status: 'DELIVERED',
          testimonial_id: 't-1',
          created_on: new Date('2026-10-01T10:00:00Z'),
          response_received_at: new Date('2026-10-01T12:00:00Z'),
        },
        {
          id: 'log-2',
          delivery_status: 'READ',
          testimonial_id: null,
          created_on: new Date('2026-10-02T11:00:00Z'),
          response_received_at: null,
        },
        {
          id: 'log-3',
          delivery_status: 'FAILED',
          testimonial_id: null,
          created_on: new Date('2026-10-02T14:00:00Z'),
          response_received_at: null,
        },
        {
          id: 'log-4',
          delivery_status: 'SENT', // in-flight / unknown outcome
          testimonial_id: null,
          created_on: new Date('2026-10-03T09:00:00Z'),
          response_received_at: null,
        },
      ];

      const prevCohort = [
        { id: 'prev-1', delivery_status: 'DELIVERED', testimonial_id: 't-prev-1' },
        { id: 'prev-2', delivery_status: 'FAILED', testimonial_id: null },
      ];

      let callCount = 0;
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve(currentCohort);
          return Promise.resolve(prevCohort);
        }),
      };
      jest.spyOn(RequestLog, 'createQueryBuilder').mockReturnValue(mockQb as any);

      const result = await service.GetRequestAnalytics('biz-1', {
        startDate,
        endDate,
      });

      expect(result.summary.total_requests).toBe(4);
      expect(result.summary.confirmed_delivered).toBe(2); // DELIVERED + READ
      expect(result.summary.confirmed_read).toBe(1);
      expect(result.summary.confirmed_failed).toBe(1);
      expect(result.summary.pending_confirmation).toBe(1); // SENT
      expect(result.summary.feedback_responses).toBe(1);

      // Known outcomes = 2 delivered + 1 failed = 3. Delivery success rate = 2 / 3 = 66.7%
      expect(result.summary.delivery_success_rate).toBe(66.7);
      // Response rate delivered = 1 response / 2 delivered = 50%
      expect(result.summary.response_rate_delivered).toBe(50);
      // Overall delivery rate = 2 / 4 = 50%
      expect(result.summary.overall_delivery_rate).toBe(50);

      // Trend array has buckets for 2026-10-01, 2026-10-02, 2026-10-03
      expect(result.trend.length).toBeGreaterThanOrEqual(3);
      const day1 = result.trend.find((t) => t.date === '2026-10-01');
      expect(day1?.created).toBe(1);
      expect(day1?.delivered).toBe(1);
      expect(day1?.responses).toBe(1);

      // Comparison vs prevCohort (2 requests, 1 delivered, 1 response)
      expect(result.comparison.prev_total_requests).toBe(2);
      expect(result.comparison.prev_confirmed_delivered).toBe(1);
      expect(result.comparison.total_requests_change_pct).toBe(100); // from 2 to 4 = +100%
      expect(result.comparison.delivered_change_pct).toBe(100); // from 1 to 2 = +100%
    });

    it('should return null delivery_success_rate honestly when 0 requests have terminal outcomes', async () => {
      const currentCohort = [
        {
          id: 'log-1',
          delivery_status: 'QUEUED',
          testimonial_id: null,
          created_on: new Date('2026-10-01T10:00:00Z'),
        },
        {
          id: 'log-2',
          delivery_status: 'PROCESSING',
          testimonial_id: null,
          created_on: new Date('2026-10-01T11:00:00Z'),
        },
      ];

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(currentCohort),
      };
      jest.spyOn(RequestLog, 'createQueryBuilder').mockReturnValue(mockQb as any);

      const result = await service.GetRequestAnalytics('biz-1', {
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-01T23:59:59.999Z',
      });

      expect(result.summary.total_requests).toBe(2);
      expect(result.summary.confirmed_delivered).toBe(0);
      expect(result.summary.confirmed_failed).toBe(0);
      expect(result.summary.pending_confirmation).toBe(2);
      // Must not fabricate 100% or 0% when unknown:
      expect(result.summary.delivery_success_rate).toBeNull();
      expect(result.summary.response_rate_delivered).toBeNull();
    });

    it('should reject invalid date range where startDate is after endDate', async () => {
      await expect(
        service.GetRequestAnalytics('biz-1', {
          startDate: '2026-10-10T00:00:00.000Z',
          endDate: '2026-10-05T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject date range exceeding 366 days', async () => {
      await expect(
        service.GetRequestAnalytics('biz-1', {
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

