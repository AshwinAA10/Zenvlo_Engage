import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { Job } from 'bullmq';

import { WebhookSecurityService } from './services/webhook-security.service';
import { WebhookService } from './services/webhook.service';
import { WebhookController } from './controllers/webhook.controller';
import { WebhookProcessor } from '../Queue/processors/webhook.processor';
import { QueueService } from '../Queue/services/queue.service';
import { InboundWebhookEvent } from './entities/inbound-webhook-event.entity';
import { RequestLog, RequestStatus } from '../Request/entities/request-log.entity';
import { EVENT_AUDIT_RECORD } from '../../common/constants';
import { UnrecoverableQueueError } from '../Queue/errors/failure-classification';

describe('Phase 6: Webhook Processing & Durable Ingestion Suite', () => {
  let securityService: WebhookSecurityService;
  let webhookService: WebhookService;
  let webhookController: WebhookController;
  let webhookProcessor: WebhookProcessor;

  const TEST_SECRET = 'live_webhook_secret_0123456789abcdef0123456789abcdef';
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const actorId = 'user-admin-123';

  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockQueueService = {
    EnqueueWebhook: jest.fn().mockResolvedValue('job-wh-1001'),
  };

  const mockClsService = {
    get: jest.fn().mockReturnValue(tenantA),
    runWith: jest.fn().mockImplementation((_, fn) => fn()),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  function computeHmac(secret: string, body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        WebhookSecurityService,
        WebhookService,
        WebhookProcessor,
        { provide: PinoLogger, useValue: mockLogger },
        { provide: QueueService, useValue: mockQueueService },
        { provide: ClsService, useValue: mockClsService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'META_APP_SECRET') return TEST_SECRET;
              if (key === 'ZENVLO_WHATSAPP_WEBHOOK_SECRET') return TEST_SECRET;
              if (key === 'WHATSAPP_VERIFY_TOKEN') return 'valid_verify_token';
              if (key === 'WEBHOOK_TOLERANCE_SECONDS') return '300';
              if (key === 'NODE_ENV') return 'production';
              return null;
            }),
          },
        },
      ],
    }).compile();

    securityService = module.get<WebhookSecurityService>(WebhookSecurityService);
    webhookService = module.get<WebhookService>(WebhookService);
    webhookController = module.get<WebhookController>(WebhookController);
    webhookProcessor = module.get<WebhookProcessor>(WebhookProcessor);
  });

  // =========================================================================
  // 1. Ingestion Security & Validation Guarantees
  // =========================================================================
  describe('1. Ingestion Security & Validation', () => {
    it('should reject invalid or forged HMAC signatures with 401 Unauthorized', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'wba-1', time: Date.now() }],
      };
      const rawBody = JSON.stringify(payload);

      await expect(
        webhookService.EnqueueMetaWebhook(payload, {
          signature: 'sha256=invalid_hex_digest_0000000000000000000000000000000000000000',
          timestamp: Date.now(),
          rawBody,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject requests exceeding the 1MB payload ceiling with 413 PayloadTooLarge', () => {
      const oversizedString = 'x'.repeat(1024 * 1024 + 10);
      expect(() => {
        securityService.ValidatePayloadSize(oversizedString);
      }).toThrow(PayloadTooLargeException);
    });

    it('should reject malformed structural shapes for Meta webhooks', () => {
      expect(() => {
        securityService.ValidateMetaPayloadShape({ wrong_root: true });
      }).toThrow(BadRequestException);

      expect(() => {
        securityService.ValidateMetaPayloadShape({ object: 'whatsapp_business_account', entry: 'not-an-array' });
      }).toThrow(BadRequestException);
    });

    it('should reject expired timestamps beyond the 300s tolerance window (replay protection)', () => {
      const expiredTimestamp = Date.now() - 301 * 1000;
      expect(() => {
        securityService.ValidateTimestamp(expiredTimestamp, 300, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // 2. Durable Inbox Persistence & Asynchronous Enqueueing
  // =========================================================================
  describe('2. Durable Inbox Persistence & Asynchronous Enqueueing', () => {
    it('should create an InboundWebhookEvent record and return acknowledgement', async () => {
      const savedEvents: InboundWebhookEvent[] = [];
      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(null);
      jest.spyOn(InboundWebhookEvent.prototype, 'save').mockImplementation(async function (this: InboundWebhookEvent) {
        this.id = 'inbound-evt-001';
        savedEvents.push(this);
        return this;
      });

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'wba-100',
            time: Date.now(),
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [{ id: 'wamid.HBgL999', status: 'delivered', timestamp: Date.now() }],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const signature = computeHmac(TEST_SECRET, rawBody);

      const result = await webhookService.EnqueueMetaWebhook(payload, {
        signature,
        timestamp: Date.now(),
        rawBody,
      });

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.jobId).toBe('job-wh-1001');
      expect(mockQueueService.EnqueueWebhook).toHaveBeenCalledWith(payload);
      expect(savedEvents.length).toBeGreaterThanOrEqual(1);
      expect(savedEvents[0].status).toBe('RECEIVED');
      expect(savedEvents[0].provider).toBe('meta_whatsapp');
      expect(savedEvents[0].event_id).toBe('wamid.HBgL999');
    });

    it('should fail with 500 without silent drop if Queue service is unavailable during ingestion', async () => {
      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(null);
      let eventStatus = '';
      jest.spyOn(InboundWebhookEvent.prototype, 'save').mockImplementation(async function (this: InboundWebhookEvent) {
        this.id = 'inbound-evt-err';
        eventStatus = this.status;
        return this;
      });

      mockQueueService.EnqueueWebhook.mockRejectedValueOnce(new Error('Redis connection refused'));

      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'wba-err', time: Date.now() }],
      };
      const rawBody = JSON.stringify(payload);
      const signature = computeHmac(TEST_SECRET, rawBody);

      await expect(
        webhookService.EnqueueMetaWebhook(payload, {
          signature,
          timestamp: Date.now(),
          rawBody,
        }),
      ).rejects.toThrow('Redis connection refused');

      expect(eventStatus).toBe('FAILED');
    });
  });

  // =========================================================================
  // 3. Worker Execution, Idempotency & Monotonic Delivery State Machine
  // =========================================================================
  describe('3. Asynchronous Worker Processing & Monotonic State Progression', () => {
    it('should process Zenvlo Engage delivery receipt and update RequestLog to DELIVERED', async () => {
      const mockLog = {
        id: 'req-log-1',
        business_id: tenantA,
        message_id: 'msg-999',
        delivery_status: 'SENT',
        delivered_at: null,
        read_at: null,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as RequestLog;

      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog);

      const mockInboundEvent = {
        id: 'inbound-evt-1',
        status: 'PROCESSING',
        attempts: 1,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as InboundWebhookEvent;

      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(mockInboundEvent);

      const mockJob = {
        id: 'job-1',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          inbound_event_id: 'inbound-evt-1',
          provider: 'zenvlo_engage',
          payload: {
            message_id: 'msg-999',
            status: 'delivered',
            business_id: tenantA,
          },
        },
      } as unknown as Job;

      const result = await webhookProcessor.handleJob(mockJob);

      expect(result.processed).toBe(true);
      expect(result.updated).toBe(true);
      expect(mockLog.delivery_status).toBe('DELIVERED');
      expect(mockLog.delivered_at).toBeInstanceOf(Date);
      expect(mockLog.save).toHaveBeenCalled();
      expect(mockInboundEvent.status).toBe('PROCESSED');
    });

    it('should advance from DELIVERED to READ and record read timestamp', async () => {
      const deliveredDate = new Date(Date.now() - 5000);
      const mockLog = {
        id: 'req-log-2',
        business_id: tenantA,
        message_id: 'msg-1002',
        delivery_status: 'DELIVERED',
        delivered_at: deliveredDate,
        read_at: null,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as RequestLog;

      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog);
      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(null);

      const mockJob = {
        id: 'job-2',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          provider: 'zenvlo_engage',
          payload: {
            message_id: 'msg-1002',
            status: 'read',
            business_id: tenantA,
          },
        },
      } as unknown as Job;

      const result = await webhookProcessor.handleJob(mockJob);

      expect(result.updated).toBe(true);
      expect(mockLog.delivery_status).toBe('READ');
      expect(mockLog.read_at).toBeInstanceOf(Date);
      expect(mockLog.delivered_at).toBe(deliveredDate);
    });

    it('should prevent status regression when an out-of-order SENT arrives after DELIVERED', async () => {
      const deliveredDate = new Date();
      const mockLog = {
        id: 'req-log-3',
        business_id: tenantA,
        message_id: 'msg-1003',
        delivery_status: 'DELIVERED',
        delivered_at: deliveredDate,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as RequestLog;

      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog);
      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(null);

      const mockJob = {
        id: 'job-3',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          provider: 'zenvlo_engage',
          payload: {
            message_id: 'msg-1003',
            status: 'sent',
            business_id: tenantA,
          },
        },
      } as unknown as Job;

      const result = await webhookProcessor.handleJob(mockJob);

      expect(result.updated).toBe(false);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe('STATUS_REGRESSION_PREVENTED');
      expect(mockLog.delivery_status).toBe('DELIVERED');
      expect(mockLog.save).not.toHaveBeenCalled();
    });

    it('should ignore duplicate status updates idempotently without modifying record', async () => {
      const mockLog = {
        id: 'req-log-4',
        business_id: tenantA,
        message_id: 'msg-1004',
        delivery_status: 'DELIVERED',
        save: jest.fn(),
      } as unknown as RequestLog;

      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog);
      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(null);

      const mockJob = {
        id: 'job-4',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          provider: 'zenvlo_engage',
          payload: {
            message_id: 'msg-1004',
            status: 'delivered',
            business_id: tenantA,
          },
        },
      } as unknown as Job;

      const result = await webhookProcessor.handleJob(mockJob);

      expect(result.updated).toBe(false);
      expect(result.duplicate).toBe(true);
      expect(result.reason).toBe('ALREADY_RECORDED');
      expect(mockLog.save).not.toHaveBeenCalled();
    });

    it('should prevent FAILED status from overwriting an already DELIVERED or READ message', async () => {
      const mockLog = {
        id: 'req-log-5',
        business_id: tenantA,
        message_id: 'msg-1005',
        delivery_status: 'READ',
        save: jest.fn(),
      } as unknown as RequestLog;

      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog);
      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(null);

      const mockJob = {
        id: 'job-5',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          provider: 'zenvlo_engage',
          payload: {
            message_id: 'msg-1005',
            status: 'failed',
            error_message: 'Delayed error callback',
          },
        },
      } as unknown as Job;

      const result = await webhookProcessor.handleJob(mockJob);

      expect(result.updated).toBe(false);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe('ALREADY_DELIVERED');
      expect(mockLog.delivery_status).toBe('READ');
      expect(mockLog.save).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. Cross-Tenant Isolation & Security Boundaries
  // =========================================================================
  describe('4. Cross-Tenant Isolation & Injection Prevention', () => {
    it('should reject cross-tenant spoofing when payload tenant mismatches authoritative record', async () => {
      const mockLog = {
        id: 'req-log-cross',
        business_id: tenantA, // Owned by Tenant A
        message_id: 'msg-cross-1',
        delivery_status: 'SENT',
        save: jest.fn(),
      } as unknown as RequestLog;

      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog);
      const mockInboundEvent = {
        id: 'inbound-evt-cross',
        status: 'PROCESSING',
        save: jest.fn().mockResolvedValue(true),
      } as unknown as InboundWebhookEvent;
      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(mockInboundEvent);

      const mockJob = {
        id: 'job-cross',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          inbound_event_id: 'inbound-evt-cross',
          provider: 'zenvlo_engage',
          payload: {
            message_id: 'msg-cross-1',
            status: 'delivered',
            business_id: tenantB, // Attacker tries to inject Tenant B
          },
        },
      } as unknown as Job;

      // Must classify as permanent unrecoverable failure and throw UnrecoverableQueueError
      await expect(webhookProcessor.handleJob(mockJob)).rejects.toThrow(UnrecoverableQueueError);
      expect(mockLog.save).not.toHaveBeenCalled();
      expect(mockInboundEvent.status).toBe('FAILED');
    });

    it('should prevent Tenant B from accessing or replaying an inbound event owned by Tenant A', async () => {
      const foreignEvent = {
        id: 'inbound-evt-tenantA',
        business_id: tenantA,
        provider: 'zenvlo_engage',
        event_id: 'evt-001',
        status: 'FAILED',
        payload: {},
        save: jest.fn(),
      } as unknown as InboundWebhookEvent;

      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(foreignEvent);

      await expect(
        webhookService.GetInboundEventById(tenantB, 'inbound-evt-tenantA'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        webhookService.ReplayInboundEvent(tenantB, 'inbound-evt-tenantA', 'actor-b'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // 5. Inspection & Manual Replay with Audit Logging
  // =========================================================================
  describe('5. Inbound Event Inspection & Replay API', () => {
    it('should query inbound events scoped to the authenticated tenant with pagination', async () => {
      const mockEvents = [
        { id: 'evt-1', provider: 'meta_whatsapp', status: 'PROCESSED' },
        { id: 'evt-2', provider: 'zenvlo_engage', status: 'FAILED' },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockEvents, 2]),
      };

      jest.spyOn(InboundWebhookEvent, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await webhookService.GetInboundEvents(tenantA, { page: 1, limit: 10, status: 'FAILED' });

      expect(result.data).toEqual(mockEvents);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        '(event.business_id = :businessId OR event.business_id IS NULL)',
        { businessId: tenantA },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.status = :status', { status: 'FAILED' });
    });

    it('should successfully replay a FAILED event, enqueue job, and emit audit event', async () => {
      const failedEvent = {
        id: 'inbound-fail-1',
        business_id: tenantA,
        provider: 'zenvlo_engage',
        event_id: 'evt-fail-1',
        event_type: 'delivery_receipt',
        status: 'FAILED',
        attempts: 3,
        last_error: 'Connection timeout',
        payload: { message_id: 'msg-fail-1', status: 'delivered' },
        metadata: {},
        save: jest.fn().mockResolvedValue(true),
      } as unknown as InboundWebhookEvent;

      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(failedEvent);

      const replayResult = await webhookService.ReplayInboundEvent(tenantA, 'inbound-fail-1', actorId);

      expect(replayResult.status).toBe('REPLAY_QUEUED');
      expect(replayResult.jobId).toBe('job-wh-1001');
      expect(failedEvent.status).toBe('RECEIVED');
      expect(failedEvent.attempts).toBe(0);
      expect(failedEvent.last_error).toBeNull();
      expect(failedEvent.save).toHaveBeenCalled();
      expect(mockQueueService.EnqueueWebhook).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EVENT_AUDIT_RECORD,
        expect.objectContaining({
          workspace_id: tenantA,
          action: 'WEBHOOK_EVENT_REPLAYED',
          entity_name: 'InboundWebhookEvent',
          entity_id: 'inbound-fail-1',
        }),
      );
    });

    it('should disallow replaying an event that has not failed', async () => {
      const processedEvent = {
        id: 'inbound-ok-1',
        business_id: tenantA,
        status: 'PROCESSED',
        save: jest.fn(),
      } as unknown as InboundWebhookEvent;

      jest.spyOn(InboundWebhookEvent, 'findOne').mockResolvedValue(processedEvent);

      await expect(
        webhookService.ReplayInboundEvent(tenantA, 'inbound-ok-1', actorId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
