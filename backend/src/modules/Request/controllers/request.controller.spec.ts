import { Test, TestingModule } from '@nestjs/testing';
import { RequestController } from './request.controller';
import { RequestService } from '../services/request.service';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

describe('RequestController', () => {
  let controller: RequestController;
  let service: RequestService;

  const mockRequestService = {
    SendSingleRequest: jest.fn(),
    SendBatchRequests: jest.fn(),
    GetRequestLogs: jest.fn(),
    GetRequestStats: jest.fn(),
    GetRequestAnalytics: jest.fn(),
    HandleWebhook: jest.fn(),
  };

  const mockJwtGuard = { canActivate: jest.fn().mockReturnValue(true) };
  const mockTenantGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequestController],
      providers: [
        {
          provide: RequestService,
          useValue: mockRequestService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .overrideGuard(TenantGuard)
      .useValue(mockTenantGuard)
      .compile();

    controller = module.get<RequestController>(RequestController);
    service = module.get<RequestService>(RequestService);
    jest.clearAllMocks();
  });

  it('should delegate GetStats to service with authenticated business_id', async () => {
    const mockStats = {
      total_sent: 10,
      delivered: 8,
      read: 5,
      failed: 1,
      pending_contract: 1,
      feedback_received: 4,
      delivery_rate: 80,
      feedback_conversion_rate: 40,
    };
    mockRequestService.GetRequestStats.mockResolvedValue(mockStats);

    const req = { user: { business_id: 'biz-123' } };
    const res = await controller.GetStats(req);

    expect(service.GetRequestStats).toHaveBeenCalledWith('biz-123');
    expect(res).toEqual(mockStats);
  });

  it('should delegate GetAnalytics to service with business_id and query params', async () => {
    const mockAnalytics = {
      period: {
        startDate: '2026-09-15T00:00:00.000Z',
        endDate: '2026-10-15T00:00:00.000Z',
        prevStartDate: '2026-08-16T00:00:00.000Z',
        prevEndDate: '2026-09-15T00:00:00.000Z',
        days: 30,
      },
      summary: {
        total_requests: 25,
        confirmed_delivered: 20,
        confirmed_read: 15,
        confirmed_failed: 2,
        pending_confirmation: 3,
        feedback_responses: 8,
        delivery_success_rate: 90.9,
        overall_delivery_rate: 80,
        response_rate_delivered: 40,
        response_rate_total: 32,
      },
      comparison: {
        prev_total_requests: 20,
        prev_confirmed_delivered: 15,
        prev_feedback_responses: 5,
        total_requests_change_pct: 25,
        delivered_change_pct: 33.3,
        responses_change_pct: 60,
      },
      delivery_breakdown: [],
      trend: [],
      meta: {
        channel: 'WHATSAPP',
        unknown_outcomes_count: 3,
        semantics: {},
      },
    };
    mockRequestService.GetRequestAnalytics.mockResolvedValue(mockAnalytics);

    const req = { user: { business_id: 'biz-123' } };
    const query = {
      startDate: '2026-09-15T00:00:00.000Z',
      endDate: '2026-10-15T00:00:00.000Z',
    };

    const res = await controller.GetAnalytics(req, query);

    expect(service.GetRequestAnalytics).toHaveBeenCalledWith('biz-123', query);
    expect(res).toEqual(mockAnalytics);
  });

  it('should delegate SendSingle to service with tenant business_id', async () => {
    const dto = { customer_name: 'John', customer_phone: '+1234567890' };
    mockRequestService.SendSingleRequest.mockResolvedValue({ id: 'log-1', ...dto });

    const req = { user: { business_id: 'biz-123' } };
    const res = await controller.SendSingle(req, dto as any);

    expect(service.SendSingleRequest).toHaveBeenCalledWith('biz-123', dto);
    expect(res.id).toBe('log-1');
  });
});
