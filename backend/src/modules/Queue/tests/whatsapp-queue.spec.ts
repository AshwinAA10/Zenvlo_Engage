import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Job } from 'bullmq';

import {
  QUEUE_WHATSAPP_OUTBOUND,
  JOB_SEND_WHATSAPP_REQUEST,
  CLS_WORKSPACE_ID,
  CLS_USER_ID,
} from '../../../common/constants';
import { RequestService } from '../../Request/services/request.service';
import { RequestLog } from '../../Request/entities/request-log.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { Business } from '../../Business/entities/business.entity';
import {
  WHATSAPP_INTEGRATION_SERVICE,
  IWhatsAppIntegrationService,
} from '../../Integration/interfaces/whatsapp-integration.interface';
import { UsageService } from '../../Billing/services/usage.service';
import { QueueService } from '../services/queue.service';
import { WhatsAppOutboundProcessor } from '../processors/whatsapp-outbound.processor';
import { OutboundWhatsAppJobPayload } from '../interfaces/job.interface';

describe('Phase 2: WhatsApp Queue & Asynchronous Architecture', () => {
  const businessId = '11111111-1111-1111-1111-111111111111';
  const foreignBusinessId = '22222222-2222-2222-2222-222222222222';

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockCls = {
    run: jest.fn().mockImplementation((fn: () => any) => fn()),
    set: jest.fn(),
    get: jest.fn(),
  };

  let mockWhatsAppService: IWhatsAppIntegrationService;
  let mockUsageService: any;
  let mockQueueService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWhatsAppService = {
      SendTestimonialRequest: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'msg_wa_real_provider_123',
        status: 'SENT',
        statusCode: 200,
        provider: 'zenvlo',
      }),
    };

    mockUsageService = {
      CheckCanSendWhatsAppRequest: jest.fn().mockResolvedValue(true),
      IncrementWhatsAppUsage: jest.fn().mockResolvedValue({}),
    };

    mockQueueService = {
      EnqueueWhatsAppOutbound: jest
        .fn()
        .mockResolvedValue('job-wa-outbound-999'),
    };
  });

  // =========================================================================
  // 1. Asynchronous API Enqueueing & Immediate Non-Blocking Response
  // =========================================================================
  describe('1. API Outbound Request Handling & Immediate Queued Response', () => {
    let requestService: RequestService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RequestService,
          { provide: PinoLogger, useValue: mockLogger },
          {
            provide: WHATSAPP_INTEGRATION_SERVICE,
            useValue: mockWhatsAppService,
          },
          { provide: QueueService, useValue: mockQueueService },
          { provide: UsageService, useValue: mockUsageService },
        ],
      }).compile();

      requestService = module.get<RequestService>(RequestService);
    });

    it('should persist RequestLog in QUEUED status and enqueue job without waiting for external provider', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: businessId,
        name: 'The Crown Cafe',
        slug: 'crown-cafe',
      } as any);

      const mockCustomer = {
        id: 'cust-10',
        business_id: businessId,
        name: 'Deepak Sharma',
        phone: '+919876543210',
        tags: [],
        metadata: {},
        request_count: 0,
        last_request_sent_at: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Customer, 'findOne').mockResolvedValue(mockCustomer as any);

      const mockSave = jest.fn().mockImplementation(function (this: any) {
        this.id = 'req-log-uuid-1';
        return Promise.resolve(this);
      });
      jest.spyOn(RequestLog.prototype, 'save').mockImplementation(mockSave);

      const response = await requestService.SendSingleRequest(businessId, {
        customer_id: 'cust-10',
        custom_message: 'Enjoyed your visit? Please leave us a review!',
      });

      // 1. Immediate QUEUED state returned
      expect(response.id).toBe('req-log-uuid-1');
      expect(response.delivery_status).toBe('QUEUED');
      expect(response.customer_name).toBe('Deepak Sharma');
      expect(response.customer_phone).toBe('+919876543210');

      // 2. Verified that provider was NOT called synchronously during API request
      expect(mockWhatsAppService.SendTestimonialRequest).not.toHaveBeenCalled();

      // 3. Enqueued to BullMQ with authoritative correlation IDs
      expect(mockQueueService.EnqueueWhatsAppOutbound).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: 'req-log-uuid-1',
          customer_phone: '+919876543210',
          idempotency_key: 'outbound_wa:req-log-uuid-1',
        }),
      );
    });

    it('should handle queue failure after database persistence cleanly (marked FAILED)', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: businessId,
        name: 'The Crown Cafe',
        slug: 'crown-cafe',
      } as any);

      const mockCustomer = {
        id: 'cust-10',
        business_id: businessId,
        name: 'Deepak Sharma',
        phone: '+919876543210',
        tags: [],
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Customer, 'findOne').mockResolvedValue(mockCustomer as any);

      const logInstance: any = {
        id: 'req-log-failed-queue',
        delivery_status: 'QUEUED',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog.prototype, 'save').mockImplementation(function (this: any) {
        this.id = 'req-log-failed-queue';
        logInstance.delivery_status = this.delivery_status;
        logInstance.error_message = this.error_message;
        return Promise.resolve(this);
      });

      // Simulate Redis/Queue failure
      mockQueueService.EnqueueWhatsAppOutbound.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Redis broker offline'),
      );

      await expect(
        requestService.SendSingleRequest(businessId, {
          customer_id: 'cust-10',
        }),
      ).rejects.toThrow(InternalServerErrorException);

      // Verifies database record transitioned to FAILED with sanitized error
      expect(logInstance.delivery_status).toBe('FAILED');
      expect(logInstance.error_message).toContain('ECONNREFUSED');
    });

    it('should reject single request if customer has opted out of WhatsApp messages', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: businessId,
        name: 'The Crown Cafe',
        slug: 'crown-cafe',
      } as any);

      // Customer with opt-out tag
      const optedOutCustomer = {
        id: 'cust-opted-out',
        business_id: businessId,
        name: 'Vikram Patel',
        phone: '+919811122233',
        tags: ['opted_out'],
        metadata: {},
        save: jest.fn(),
      };
      jest.spyOn(Customer, 'findOne').mockResolvedValue(optedOutCustomer as any);

      await expect(
        requestService.SendSingleRequest(businessId, {
          customer_id: 'cust-opted-out',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueueService.EnqueueWhatsAppOutbound).not.toHaveBeenCalled();
    });

    it('should reject single request if subscription quota is exhausted', async () => {
      mockUsageService.CheckCanSendWhatsAppRequest.mockRejectedValueOnce(
        new ForbiddenException('Monthly limit reached'),
      );

      await expect(
        requestService.SendSingleRequest(businessId, {
          customer_name: 'Rohit Verma',
          customer_phone: '+919888877777',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockQueueService.EnqueueWhatsAppOutbound).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Outbound Worker Processor Execution & State Tracking
  // =========================================================================
  describe('2. WhatsAppOutboundProcessor Worker Execution & State Machine', () => {
    let processor: WhatsAppOutboundProcessor;

    beforeEach(() => {
      processor = new WhatsAppOutboundProcessor(
        mockLogger as any,
        mockCls as any,
        mockWhatsAppService,
        mockUsageService,
      );
    });

    it('should retrieve authoritative record, submit to Zenvlo Engage, and update status to SENT', async () => {
      const mockLog = {
        id: 'req-log-100',
        business_id: businessId,
        customer_id: 'cust-100',
        customer_name: 'Sneha Patel',
        customer_phone: '+919876543210',
        channel: 'WHATSAPP',
        template_name: 'testimonial_request',
        testimonial_url: 'http://localhost:3000/submit/test-biz',
        custom_message: 'Welcome!',
        delivery_status: 'QUEUED',
        message_id: null,
        sent_at: null,
        error_message: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const mockCustomer = {
        id: 'cust-100',
        business_id: businessId,
        tags: [],
        metadata: {},
        request_count: 2,
        last_request_sent_at: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Customer, 'findOne').mockResolvedValue(mockCustomer as any);
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: businessId,
        name: 'The Grand Salon',
      } as any);

      const mockJob = {
        id: 'job-outbound-1',
        name: JOB_SEND_WHATSAPP_REQUEST,
        data: {
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: 'req-log-100',
          customer_id: 'cust-100',
          customer_phone: '+919876543210',
          customer_name: 'Sneha Patel',
          testimonial_url: 'http://localhost:3000/submit/test-biz',
          idempotency_key: 'outbound_wa:req-log-100',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<OutboundWhatsAppJobPayload>;

      const result = await processor.process(mockJob);

      // Verifies provider integration invocation
      expect(mockWhatsAppService.SendTestimonialRequest).toHaveBeenCalledWith({
        businessId,
        businessName: 'The Grand Salon',
        customerName: 'Sneha Patel',
        customerPhone: '+919876543210',
        testimonialUrl: 'http://localhost:3000/submit/test-biz',
        customMessage: 'Welcome!',
      });

      // Verifies provider acceptance is tracked as SENT (NOT DELIVERED)
      expect(result.status).toBe('SENT');
      expect(result.messageId).toBe('msg_wa_real_provider_123');
      expect(mockLog.delivery_status).toBe('SENT');
      expect(mockLog.message_id).toBe('msg_wa_real_provider_123');
      expect(mockLog.sent_at).toBeDefined();

      // Verifies customer counter & billing quota incremented
      expect(mockCustomer.request_count).toBe(3);
      expect(mockCustomer.last_request_sent_at).toBeDefined();
      expect(mockUsageService.IncrementWhatsAppUsage).toHaveBeenCalledWith(businessId);
    });

    it('should prevent duplicate provider submissions on repeated job delivery (idempotency)', async () => {
      // Record already has message_id and is SENT
      const mockLog = {
        id: 'req-log-already-sent',
        business_id: businessId,
        delivery_status: 'SENT',
        message_id: 'msg_previously_sent_456',
        save: jest.fn(),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const mockJob = {
        id: 'job-redelivery-2',
        name: JOB_SEND_WHATSAPP_REQUEST,
        data: {
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: 'req-log-already-sent',
          customer_phone: '+919876543210',
          customer_name: 'Sneha Patel',
          testimonial_url: 'http://localhost:3000/submit/test-biz',
          idempotency_key: 'outbound_wa:req-log-already-sent',
          timestamp: Date.now(),
        },
        attemptsMade: 1,
      } as unknown as Job<OutboundWhatsAppJobPayload>;

      const result = await processor.process(mockJob);

      expect(result.duplicate).toBe(true);
      expect(result.messageId).toBe('msg_previously_sent_456');
      // Crucial: Provider must NOT be called a second time
      expect(mockWhatsAppService.SendTestimonialRequest).not.toHaveBeenCalled();
      expect(mockUsageService.IncrementWhatsAppUsage).not.toHaveBeenCalled();
    });

    it('should abort send in worker if customer opted out after enqueueing', async () => {
      const mockLog = {
        id: 'req-log-opted-out',
        business_id: businessId,
        customer_id: 'cust-optout-late',
        delivery_status: 'QUEUED',
        message_id: null,
        error_message: null as string | null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const mockCustomer = {
        id: 'cust-optout-late',
        business_id: businessId,
        tags: [],
        metadata: { opted_out: true }, // Opted out in metadata
        save: jest.fn(),
      };
      jest.spyOn(Customer, 'findOne').mockResolvedValue(mockCustomer as any);

      const mockJob = {
        id: 'job-optout-late',
        name: JOB_SEND_WHATSAPP_REQUEST,
        data: {
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: 'req-log-opted-out',
          customer_id: 'cust-optout-late',
          customer_phone: '+919876543210',
          customer_name: 'Late Optout',
          testimonial_url: 'http://localhost:3000/submit/test-biz',
          idempotency_key: 'outbound_wa:req-log-opted-out',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
      } as unknown as Job<OutboundWhatsAppJobPayload>;

      const result = await processor.process(mockJob);

      expect(result.status).toBe('FAILED');
      expect(result.reason).toBe('OPTED_OUT');
      expect(mockLog.delivery_status).toBe('FAILED');
      expect(mockLog.error_message).toContain('opted out');
      expect(mockWhatsAppService.SendTestimonialRequest).not.toHaveBeenCalled();
    });

    it('should trigger retry when provider rate limit (429) or temporary server error occurs', async () => {
      const mockLog = {
        id: 'req-log-retry',
        business_id: businessId,
        delivery_status: 'QUEUED',
        message_id: null,
        error_message: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);
      jest.spyOn(Business, 'findOne').mockResolvedValue({ id: businessId } as any);

      // Provider returns 429 Rate Limit
      (mockWhatsAppService.SendTestimonialRequest as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 'FAILED',
        statusCode: 429,
        errorMessage: 'Provider rate limit exceeded. Try again in 2s.',
      });

      const mockJob = {
        id: 'job-retry-429',
        name: JOB_SEND_WHATSAPP_REQUEST,
        data: {
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: 'req-log-retry',
          customer_phone: '+919876543210',
          customer_name: 'Rate Limited',
          testimonial_url: 'http://localhost:3000/submit/test-biz',
          idempotency_key: 'outbound_wa:req-log-retry',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<OutboundWhatsAppJobPayload>;

      // Must throw an error so BullMQ triggers backoff retry
      await expect(processor.process(mockJob)).rejects.toThrow(
        /rate limit exceeded/i,
      );

      expect(mockLog.error_message).toContain('Attempt 1 failed');
    });

    it('should record permanent FAILED state without retrying on client validation errors (400/422)', async () => {
      const mockLog = {
        id: 'req-log-perm-fail',
        business_id: businessId,
        delivery_status: 'QUEUED',
        message_id: null,
        error_message: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);
      jest.spyOn(Business, 'findOne').mockResolvedValue({ id: businessId } as any);

      // Provider rejects with 400 Invalid phone number format
      (mockWhatsAppService.SendTestimonialRequest as jest.Mock).mockResolvedValueOnce({
        success: false,
        status: 'FAILED',
        statusCode: 400,
        errorMessage: 'Invalid phone number format: not a WhatsApp user',
      });

      const mockJob = {
        id: 'job-perm-fail-400',
        name: JOB_SEND_WHATSAPP_REQUEST,
        data: {
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: 'req-log-perm-fail',
          customer_phone: '+910000000000',
          customer_name: 'Bad Phone',
          testimonial_url: 'http://localhost:3000/submit/test-biz',
          idempotency_key: 'outbound_wa:req-log-perm-fail',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<OutboundWhatsAppJobPayload>;

      const result = await processor.process(mockJob);

      expect(result.status).toBe('FAILED');
      expect(mockLog.delivery_status).toBe('FAILED');
      expect(mockLog.error_message).toContain('Invalid phone number format');
    });

    it('should reject foreign tenant job when workspace context does not match database record', async () => {
      // Mock record belongs to foreignBusinessId
      const mockLog = {
        id: 'req-log-foreign',
        business_id: foreignBusinessId,
      };
      jest.spyOn(RequestLog, 'findOne').mockImplementation(async (opts: any) => {
        if (opts?.where?.business_id === businessId) {
          return null; // Tenant isolation blocks query
        }
        return mockLog as any;
      });

      const mockJob = {
        id: 'job-tenant-cross',
        name: JOB_SEND_WHATSAPP_REQUEST,
        data: {
          workspace_id: businessId, // Attacker tenant
          business_id: businessId,
          request_log_id: 'req-log-foreign',
          customer_phone: '+919999999999',
          customer_name: 'Target Customer',
          testimonial_url: 'http://localhost:3000/submit/test-biz',
          idempotency_key: 'outbound_wa:req-log-foreign',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
      } as unknown as Job<OutboundWhatsAppJobPayload>;

      const result = await processor.process(mockJob);

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('RECORD_NOT_FOUND');
      expect(mockWhatsAppService.SendTestimonialRequest).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Batch Outbound Processing & Independent Worker Wiring
  // =========================================================================
  describe('3. Batch Outbound Enqueueing & Delivery Tracking Integration', () => {
    let requestService: RequestService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RequestService,
          { provide: PinoLogger, useValue: mockLogger },
          {
            provide: WHATSAPP_INTEGRATION_SERVICE,
            useValue: mockWhatsAppService,
          },
          { provide: QueueService, useValue: mockQueueService },
          { provide: UsageService, useValue: mockUsageService },
        ],
      }).compile();

      requestService = module.get<RequestService>(RequestService);
    });

    it('should enqueue batch requests asynchronously without blocking on provider delivery', async () => {
      jest.spyOn(Business, 'findOne').mockResolvedValue({
        id: businessId,
        name: 'The Crown Cafe',
        slug: 'crown-cafe',
      } as any);

      const customer1 = {
        id: 'cust-batch-1',
        business_id: businessId,
        name: 'Cust One',
        phone: '+919000000001',
        tags: [],
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };
      const customer2 = {
        id: 'cust-batch-2',
        business_id: businessId,
        name: 'Cust Two',
        phone: '+919000000002',
        tags: [],
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Customer, 'findOne').mockImplementation(async (opts: any) => {
        if (opts?.where?.id === 'cust-batch-1') return customer1 as any;
        if (opts?.where?.id === 'cust-batch-2') return customer2 as any;
        return null;
      });

      let saveCount = 0;
      jest.spyOn(RequestLog.prototype, 'save').mockImplementation(function (this: any) {
        saveCount++;
        this.id = `req-log-batch-${saveCount}`;
        return Promise.resolve(this);
      });

      const batchResult = await requestService.SendBatchRequests(businessId, {
        customer_ids: ['cust-batch-1', 'cust-batch-2'],
        custom_message: 'Batch message for VIP customers',
      });

      expect(batchResult.total).toBe(2);
      expect(batchResult.queued).toBe(2);
      expect(batchResult.failed).toBe(0);
      expect(batchResult.logs.length).toBe(2);
      expect(batchResult.logs[0].delivery_status).toBe('QUEUED');
      expect(batchResult.logs[1].delivery_status).toBe('QUEUED');

      // Both jobs enqueued to BullMQ
      expect(mockQueueService.EnqueueWhatsAppOutbound).toHaveBeenCalledTimes(2);
    });
  });
});
