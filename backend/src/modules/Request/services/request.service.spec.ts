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
});
