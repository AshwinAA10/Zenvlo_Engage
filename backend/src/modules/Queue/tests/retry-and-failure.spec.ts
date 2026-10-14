import { Job, Queue } from 'bullmq';
import {
  ErrorCategory,
  classifyFailure,
  UnrecoverableQueueError,
} from '../errors/failure-classification';
import { calculateBackoffWithJitter } from '../config/queue.config';
import { WhatsAppOutboundProcessor } from '../processors/whatsapp-outbound.processor';
import { QueueAdminService } from '../services/queue-admin.service';
import { QueueService } from '../services/queue.service';
import { RequestLog } from '../../Request/entities/request-log.entity';
import { Customer } from '../../Customer/entities/customer.entity';
import { Business } from '../../Business/entities/business.entity';
import { AuditLog } from '../../System/entities/audit-log.entity';
import {
  QUEUE_WHATSAPP_OUTBOUND,
  JOB_SEND_WHATSAPP_REQUEST,
} from '../../../common/constants';
import { OutboundWhatsAppJobPayload } from '../interfaces/job.interface';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('Phase 3: Retry & Failure Handling Architecture', () => {
  const businessId = '11111111-1111-1111-1111-111111111111';
  const foreignBusinessId = '22222222-2222-2222-2222-222222222222';
  const actorId = 'actor-admin-123';

  // =========================================================================
  // 1. Explicit Failure Classification Engine Tests
  // =========================================================================
  describe('1. Failure Classification Engine', () => {
    it('should classify transient network failures (ETIMEDOUT, ECONNRESET, DNS) as retryable', () => {
      const econnreset = classifyFailure(new Error('read ECONNRESET at TLSWrap.onStreamRead'));
      expect(econnreset.category).toBe(ErrorCategory.TRANSIENT_NETWORK);
      expect(econnreset.isRetryable).toBe(true);

      const etimedout = classifyFailure('connect ETIMEDOUT 104.244.42.1:443');
      expect(etimedout.category).toBe(ErrorCategory.TRANSIENT_NETWORK);
      expect(etimedout.isRetryable).toBe(true);

      const enotfound = classifyFailure('getaddrinfo ENOTFOUND api.zenvlo.com');
      expect(enotfound.category).toBe(ErrorCategory.TRANSIENT_NETWORK);
      expect(enotfound.isRetryable).toBe(true);
    });

    it('should classify temporary provider outages (502, 503, 504) as retryable', () => {
      const outage502 = classifyFailure('Bad Gateway', { statusCode: 502 });
      expect(outage502.category).toBe(ErrorCategory.PROVIDER_OUTAGE);
      expect(outage502.isRetryable).toBe(true);

      const outage503 = classifyFailure('Service Temporarily Unavailable', { statusCode: 503 });
      expect(outage503.category).toBe(ErrorCategory.PROVIDER_OUTAGE);
      expect(outage503.isRetryable).toBe(true);
    });

    it('should classify rate limiting (429) and preserve Retry-After instructions', () => {
      const rateLimit = classifyFailure('Rate limit exceeded', {
        statusCode: 429,
        retryAfterSeconds: 30,
      });
      expect(rateLimit.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(rateLimit.isRetryable).toBe(true);
      expect(rateLimit.retryAfterSeconds).toBe(30);
      expect(rateLimit.reason).toContain('Retry after 30s');
    });

    it('should classify permanent validation errors (400, 422, opted out) as non-retryable terminal', () => {
      const validation400 = classifyFailure('Invalid recipient phone number format', {
        statusCode: 400,
      });
      expect(validation400.category).toBe(ErrorCategory.PERMANENT_VALIDATION);
      expect(validation400.isRetryable).toBe(false);

      const optedOut = classifyFailure('Customer has opted out of WhatsApp messages');
      expect(optedOut.category).toBe(ErrorCategory.PERMANENT_VALIDATION);
      expect(optedOut.isRetryable).toBe(false);
    });

    it('should classify authentication/credential failures (401, 403) as terminal and flag operator', () => {
      const auth401 = classifyFailure('Invalid API Key provided', { statusCode: 401 });
      expect(auth401.category).toBe(ErrorCategory.INVALID_CREDENTIALS);
      expect(auth401.isRetryable).toBe(false);

      const auth403 = classifyFailure('Forbidden access to WhatsApp channel', { statusCode: 403 });
      expect(auth403.category).toBe(ErrorCategory.INVALID_CREDENTIALS);
      expect(auth403.isRetryable).toBe(false);
    });

    it('should classify post-dispatch timeouts as AMBIGUOUS_OUTCOME and safeguard against blind resends', () => {
      const ambiguous = classifyFailure('Socket timed out after request dispatched', {
        isTimeout: true,
        hasSentPayload: true,
      });
      expect(ambiguous.category).toBe(ErrorCategory.AMBIGUOUS_OUTCOME);
      expect(ambiguous.isRetryable).toBe(false);
      expect(ambiguous.isAmbiguous).toBe(true);
    });
  });

  // =========================================================================
  // 2. Deterministic Bounded Exponential Backoff & Jitter Tests
  // =========================================================================
  describe('2. Bounded Exponential Backoff with Jitter', () => {
    it('should scale exponentially and respect deterministic jitter boundaries', () => {
      // Deterministic minimum jitter (random = 0)
      const minRandom = () => 0.0;
      expect(calculateBackoffWithJitter(0, 2000, 60000, 0.2, minRandom)).toBe(2000);
      expect(calculateBackoffWithJitter(1, 2000, 60000, 0.2, minRandom)).toBe(4000);
      expect(calculateBackoffWithJitter(2, 2000, 60000, 0.2, minRandom)).toBe(8000);
      expect(calculateBackoffWithJitter(3, 2000, 60000, 0.2, minRandom)).toBe(16000);

      // Deterministic maximum jitter (random = 1.0)
      const maxRandom = () => 1.0;
      expect(calculateBackoffWithJitter(0, 2000, 60000, 0.2, maxRandom)).toBe(2400); // 2000 + 20%
      expect(calculateBackoffWithJitter(1, 2000, 60000, 0.2, maxRandom)).toBe(4800); // 4000 + 20%
      expect(calculateBackoffWithJitter(2, 2000, 60000, 0.2, maxRandom)).toBe(9600); // 8000 + 20%

      // Respect maximum delay cap
      expect(calculateBackoffWithJitter(10, 2000, 60000, 0.2, minRandom)).toBe(60000);
    });
  });

  // =========================================================================
  // 3. Worker Execution: Retry, Failure & Ambiguity Safeguards
  // =========================================================================
  describe('3. WhatsAppOutboundProcessor Failure Recovery', () => {
    let processor: WhatsAppOutboundProcessor;
    let mockLogger: any;
    let mockCls: any;
    let mockWhatsAppService: any;
    let mockUsageService: any;

    beforeEach(() => {
      mockLogger = {
        setContext: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      mockCls = {
        run: jest.fn().mockImplementation((fn: () => any) => fn()),
        set: jest.fn(),
        get: jest.fn(),
      };
      mockWhatsAppService = {
        SendTestimonialRequest: jest.fn(),
      };
      mockUsageService = {
        CheckCanSendWhatsAppRequest: jest.fn().mockResolvedValue(true),
        IncrementWhatsAppUsage: jest.fn().mockResolvedValue(true),
      };

      processor = new WhatsAppOutboundProcessor(
        mockLogger as any,
        mockCls as any,
        mockWhatsAppService,
        mockUsageService,
      );
    });

    it('should halt blind retries on ambiguous provider timeout and mark record as AMBIGUOUS', async () => {
      const mockLog = {
        id: 'req-log-ambiguous',
        business_id: businessId,
        customer_id: 'cust-ambiguous',
        customer_phone: '+919876543210',
        customer_name: 'Ambiguous User',
        delivery_status: 'QUEUED',
        message_id: null,
        error_message: null as string | null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);
      jest.spyOn(Customer, 'findOne').mockResolvedValue({ id: 'cust-ambiguous', business_id: businessId } as any);
      jest.spyOn(Business, 'findOne').mockResolvedValue({ id: businessId } as any);

      // Provider times out AFTER dispatch
      mockWhatsAppService.SendTestimonialRequest.mockResolvedValueOnce({
        success: false,
        status: 'FAILED',
        statusCode: 504,
        isTimeout: true,
        isAmbiguous: true,
        errorMessage: 'WhatsApp provider request timed out after payload dispatch',
      });

      const mockJob = {
        id: 'job-ambiguous-1',
        name: JOB_SEND_WHATSAPP_REQUEST,
        data: {
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: 'req-log-ambiguous',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<OutboundWhatsAppJobPayload>;

      const result = await processor.process(mockJob);

      // Must transition to AMBIGUOUS and NOT throw a retryable error
      expect(result.status).toBe('AMBIGUOUS');
      expect(mockLog.delivery_status).toBe('AMBIGUOUS');
      expect(mockLog.error_message).toContain('AMBIGUOUS_OUTCOME');
      expect(mockLog.error_message).toContain('Reconciliation required');
    });

    it('should record permanent FAILED state when all retry attempts are exhausted', async () => {
      const mockLog = {
        id: 'req-log-exhausted',
        business_id: businessId,
        customer_id: 'cust-exhausted',
        delivery_status: 'PROCESSING',
        message_id: null,
        error_message: null as string | null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);
      jest.spyOn(Customer, 'findOne').mockResolvedValue({ id: 'cust-exhausted', business_id: businessId } as any);
      jest.spyOn(Business, 'findOne').mockResolvedValue({ id: businessId } as any);

      // Temporary error (503) on 3rd attempt (attemptsMade = 2 out of 3)
      mockWhatsAppService.SendTestimonialRequest.mockResolvedValueOnce({
        success: false,
        status: 'FAILED',
        statusCode: 503,
        errorMessage: 'Service Unavailable',
      });

      const mockJob = {
        id: 'job-exhausted-3',
        name: JOB_SEND_WHATSAPP_REQUEST,
        data: {
          workspace_id: businessId,
          business_id: businessId,
          request_log_id: 'req-log-exhausted',
        },
        attemptsMade: 2, // Final attempt
        opts: { attempts: 3 },
      } as unknown as Job<OutboundWhatsAppJobPayload>;

      await expect(processor.process(mockJob)).rejects.toThrow(/retries exhausted/i);

      expect(mockLog.delivery_status).toBe('FAILED');
      expect(mockLog.error_message).toContain('All 3 attempts exhausted');
      expect(mockLog.error_message).toContain('PROVIDER_OUTAGE');
    });
  });

  // =========================================================================
  // 4. QueueAdminService: Failed Job Inspection, Safe Replay & Idempotency
  // =========================================================================
  describe('4. QueueAdminService: Safe Inspection & Replay', () => {
    let adminService: QueueAdminService;
    let mockQueueService: any;
    let mockQueue: any;
    let mockLogger: any;

    beforeEach(() => {
      mockLogger = {
        setContext: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      mockQueue = {
        getFailed: jest.fn(),
        getJob: jest.fn(),
      };

      mockQueueService = {
        GetQueue: jest.fn().mockReturnValue(mockQueue),
      };

      adminService = new QueueAdminService(mockQueueService as any, mockLogger as any);
    });

    it('should list failed jobs for current tenant only (tenant isolation)', async () => {
      mockQueue.getFailed.mockResolvedValue([
        {
          id: 'job-1',
          name: JOB_SEND_WHATSAPP_REQUEST,
          attemptsMade: 3,
          failedReason: 'Error: Rate limit',
          timestamp: Date.now(),
          data: { workspace_id: businessId, customer_phone: '+919876543210' },
        },
        {
          id: 'job-foreign',
          name: JOB_SEND_WHATSAPP_REQUEST,
          attemptsMade: 3,
          failedReason: 'Error: Forbidden',
          timestamp: Date.now(),
          data: { workspace_id: foreignBusinessId, customer_phone: '+919999999999' },
        },
      ]);

      const result = await adminService.getFailedJobs(businessId, QUEUE_WHATSAPP_OUTBOUND);

      expect(result.total).toBe(1);
      expect(result.jobs[0].jobId).toBe('job-1');
      expect(result.jobs[0].customerPhone).toBe('+91****3210'); // Masked PII
    });

    it('should refuse replay of job belonging to another tenant (ForbiddenException)', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'foreign-job',
        data: { workspace_id: foreignBusinessId },
      });

      await expect(
        adminService.replayFailedJob(businessId, actorId, QUEUE_WHATSAPP_OUTBOUND, 'foreign-job'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should refuse replay if underlying message was already SENT or DELIVERED (Duplicate Prevention)', async () => {
      const retrySpy = jest.fn();
      mockQueue.getJob.mockResolvedValue({
        id: 'job-dup-check',
        data: {
          workspace_id: businessId,
          request_log_id: 'req-log-sent',
        },
        retry: retrySpy,
      });

      jest.spyOn(RequestLog, 'findOne').mockResolvedValue({
        id: 'req-log-sent',
        business_id: businessId,
        delivery_status: 'SENT',
        message_id: 'msg_existing_provider_999',
      } as any);

      await expect(
        adminService.replayFailedJob(businessId, actorId, QUEUE_WHATSAPP_OUTBOUND, 'job-dup-check'),
      ).rejects.toThrow(ConflictException);

      expect(retrySpy).not.toHaveBeenCalled();
    });

    it('should refuse replay on AMBIGUOUS job unless force: true is provided', async () => {
      mockQueue.getJob.mockResolvedValue({
        id: 'job-amb-check',
        data: {
          workspace_id: businessId,
          request_log_id: 'req-log-amb',
        },
        retry: jest.fn(),
      });

      jest.spyOn(RequestLog, 'findOne').mockResolvedValue({
        id: 'req-log-amb',
        business_id: businessId,
        delivery_status: 'AMBIGUOUS',
        message_id: null,
      } as any);

      // Without force: true -> rejects
      await expect(
        adminService.replayFailedJob(businessId, actorId, QUEUE_WHATSAPP_OUTBOUND, 'job-amb-check'),
      ).rejects.toThrow(BadRequestException);

      // With force: true -> proceeds
      const mockLog = {
        id: 'req-log-amb',
        business_id: businessId,
        delivery_status: 'AMBIGUOUS',
        message_id: null,
        error_message: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);
      jest.spyOn(AuditLog.prototype, 'save').mockResolvedValue({} as any);

      const replayResult = await adminService.replayFailedJob(
        businessId,
        actorId,
        QUEUE_WHATSAPP_OUTBOUND,
        'job-amb-check',
        { force: true },
      );

      expect(replayResult.success).toBe(true);
      expect(replayResult.status).toBe('REPLAYED');
      expect(mockLog.delivery_status).toBe('QUEUED');
    });

    it('should reconcile ambiguous requests and audit log the reconciliation', async () => {
      const mockAmbiguousLog = {
        id: 'req-log-reconcile-1',
        business_id: businessId,
        delivery_status: 'AMBIGUOUS',
        message_id: null,
        error_message: null as string | null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'find').mockResolvedValue([mockAmbiguousLog as any]);
      jest.spyOn(AuditLog.prototype, 'save').mockResolvedValue({} as any);

      const result = await adminService.reconcileAmbiguous(businessId, actorId);

      expect(result.reconciled).toBe(1);
      expect(mockAmbiguousLog.delivery_status).toBe('FAILED');
      expect(mockAmbiguousLog.error_message).toContain('RECONCILED');
    });
  });
});
