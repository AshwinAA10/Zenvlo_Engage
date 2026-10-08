import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import * as crypto from 'crypto';
import { WebhookSecurityService } from './services/webhook-security.service';
import { WebhookService } from './services/webhook.service';
import { QueueService } from '../Queue/services/queue.service';
import { ClsService } from 'nestjs-cls';
import { RequestService } from '../Request/services/request.service';
import { RequestLog } from '../Request/entities/request-log.entity';
import { WHATSAPP_INTEGRATION_SERVICE } from '../Integration/interfaces/whatsapp-integration.interface';

describe('WhatsApp Webhook Security (Phase 9B)', () => {
  let securityService: WebhookSecurityService;
  let webhookService: WebhookService;
  let requestService: RequestService;
  let configService: ConfigService;

  const TEST_SECRET = 'live_webhook_secret_0123456789abcdef0123456789abcdef';
  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockQueueService = {
    EnqueueWebhook: jest.fn().mockResolvedValue('job-12345'),
  };

  const mockClsService = {
    get: jest.fn().mockReturnValue('workspace-test-uuid'),
  };

  const mockWhatsAppService = {
    SendTestimonialRequest: jest.fn(),
  };

  function computeHmacSha256(secret: string, body: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSecurityService,
        WebhookService,
        RequestService,
        { provide: PinoLogger, useValue: mockLogger },
        { provide: QueueService, useValue: mockQueueService },
        { provide: ClsService, useValue: mockClsService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'META_APP_SECRET') return TEST_SECRET;
              if (key === 'ZENVLO_WHATSAPP_WEBHOOK_SECRET') return TEST_SECRET;
              if (key === 'ZENVLO_WHATSAPP_API_KEY') return TEST_SECRET;
              if (key === 'WEBHOOK_TOLERANCE_SECONDS') return '300';
              if (key === 'NODE_ENV') return 'production';
              return null;
            }),
          },
        },
        {
          provide: WHATSAPP_INTEGRATION_SERVICE,
          useValue: mockWhatsAppService,
        },
      ],
    }).compile();

    securityService = module.get<WebhookSecurityService>(WebhookSecurityService);
    webhookService = module.get<WebhookService>(WebhookService);
    requestService = module.get<RequestService>(RequestService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('1. HMAC Signature Verification', () => {
    it('should accept valid HMAC-SHA256 signature with sha256= prefix', () => {
      const payload = JSON.stringify({ event: 'message_delivered', id: '123' });
      const signature = computeHmacSha256(TEST_SECRET, payload);

      expect(() => {
        securityService.VerifySignature(payload, signature, TEST_SECRET, 'TestProvider');
      }).not.toThrow();
    });

    it('should accept valid raw hex HMAC-SHA256 signature without sha256= prefix', () => {
      const payload = JSON.stringify({ event: 'message_delivered', id: '123' });
      const signature = crypto.createHmac('sha256', TEST_SECRET).update(payload, 'utf8').digest('hex');

      expect(() => {
        securityService.VerifySignature(payload, signature, TEST_SECRET, 'TestProvider');
      }).not.toThrow();
    });

    it('should reject invalid HMAC signature', () => {
      const payload = JSON.stringify({ event: 'message_delivered', id: '123' });
      const invalidSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

      expect(() => {
        securityService.VerifySignature(payload, invalidSignature, TEST_SECRET, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });

    it('should reject missing signature', () => {
      const payload = JSON.stringify({ event: 'message_delivered' });

      expect(() => {
        securityService.VerifySignature(payload, undefined, TEST_SECRET, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });

    it('should reject empty or whitespace signature', () => {
      const payload = JSON.stringify({ event: 'message_delivered' });

      expect(() => {
        securityService.VerifySignature(payload, '   ', TEST_SECRET, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });

    it('should reject malformed non-hex signature', () => {
      const payload = JSON.stringify({ event: 'message_delivered' });

      expect(() => {
        securityService.VerifySignature(payload, 'sha256=not-a-valid-hex-string!!!', TEST_SECRET, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });

    it('should detect and reject tampered / modified payload', () => {
      const originalPayload = JSON.stringify({ amount: 100, status: 'DELIVERED' });
      const signature = computeHmacSha256(TEST_SECRET, originalPayload);
      const tamperedPayload = JSON.stringify({ amount: 99999, status: 'DELIVERED' });

      expect(() => {
        securityService.VerifySignature(tamperedPayload, signature, TEST_SECRET, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });

    it('should fail closed when webhook secret is missing in production', () => {
      const payload = JSON.stringify({ event: 'status_update' });
      const signature = 'sha256=abcdef';

      expect(() => {
        securityService.VerifySignature(payload, signature, undefined, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });

    it('should fail closed when placeholder secret is configured in production', () => {
      const payload = JSON.stringify({ event: 'status_update' });
      const signature = 'sha256=abcdef';

      expect(() => {
        securityService.VerifySignature(
          payload,
          signature,
          'placeholder_meta_app_secret',
          'TestProvider',
        );
      }).toThrow(UnauthorizedException);
    });
  });

  describe('2. Timestamp Validation & Replay Protection', () => {
    it('should accept current valid timestamp', () => {
      const now = Date.now();
      expect(() => {
        securityService.ValidateTimestamp(now, 300, 'TestProvider');
      }).not.toThrow();
    });

    it('should accept ISO date string within tolerance window', () => {
      const iso = new Date().toISOString();
      expect(() => {
        securityService.ValidateTimestamp(iso, 300, 'TestProvider');
      }).not.toThrow();
    });

    it('should accept epoch seconds format', () => {
      const epochSeconds = Math.floor(Date.now() / 1000);
      expect(() => {
        securityService.ValidateTimestamp(epochSeconds, 300, 'TestProvider');
      }).not.toThrow();
    });

    it('should reject expired timestamp older than tolerance window (replay attack)', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      expect(() => {
        securityService.ValidateTimestamp(tenMinutesAgo, 300, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });

    it('should reject future timestamp with clock drift > 60s', () => {
      const twoMinutesInFuture = Date.now() + 120 * 1000;
      expect(() => {
        securityService.ValidateTimestamp(twoMinutesInFuture, 300, 'TestProvider');
      }).toThrow(UnauthorizedException);
    });

    it('should reject missing timestamp', () => {
      expect(() => {
        securityService.ValidateTimestamp(undefined, 300, 'TestProvider');
      }).toThrow(BadRequestException);
    });

    it('should reject malformed unparseable timestamp', () => {
      expect(() => {
        securityService.ValidateTimestamp('invalid-date-string-not-epoch', 300, 'TestProvider');
      }).toThrow(BadRequestException);
    });
  });

  describe('3. Payload Size & Structural Shape Validation', () => {
    it('should accept payload within 1MB limit', () => {
      const smallPayload = '{"status":"ok"}';
      expect(() => {
        securityService.ValidatePayloadSize(smallPayload, 1048576);
      }).not.toThrow();
    });

    it('should reject oversized payload exceeding 1MB', () => {
      const oversizedPayload = 'x'.repeat(1048577);
      expect(() => {
        securityService.ValidatePayloadSize(oversizedPayload, 1048576);
      }).toThrow(PayloadTooLargeException);
    });

    it('should validate Meta payload structure: accept valid entry array', () => {
      const validMetaPayload = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'wba-1', changes: [] }],
      };
      expect(() => {
        securityService.ValidateMetaPayloadShape(validMetaPayload);
      }).not.toThrow();
    });

    it('should reject Meta payload with missing object property', () => {
      const malformed = { entry: [{ id: 'wba-1' }] };
      expect(() => {
        securityService.ValidateMetaPayloadShape(malformed);
      }).toThrow(BadRequestException);
    });

    it('should reject Meta payload with missing or non-array entry', () => {
      const malformed = { object: 'whatsapp_business_account', entry: 'not-an-array' };
      expect(() => {
        securityService.ValidateMetaPayloadShape(malformed);
      }).toThrow(BadRequestException);
    });

    it('should reject non-object payload', () => {
      expect(() => {
        securityService.ValidateMetaPayloadShape('just a string');
      }).toThrow(BadRequestException);
    });
  });

  describe('4. Meta Webhook Ingestion via WebhookService', () => {
    it('should successfully authenticate and enqueue valid Meta WhatsApp webhook', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'wba-999',
            time: Date.now(),
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [{ id: 'wamid.HBgL12345', status: 'delivered', timestamp: Date.now() }],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      const result = await webhookService.EnqueueMetaWebhook(payload, {
        signature,
        timestamp: Date.now(),
        rawBody,
      });

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.jobId).toBe('job-12345');
      expect(mockQueueService.EnqueueWebhook).toHaveBeenCalledWith(payload);
    });

    it('should reject Meta webhook with invalid signature', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'wba-999', time: Date.now() }],
      };
      const rawBody = JSON.stringify(payload);

      await expect(
        webhookService.EnqueueMetaWebhook(payload, {
          signature: 'sha256=invalid000000000000000000000000000000000000000000000000000000000000',
          timestamp: Date.now(),
          rawBody,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject Meta webhook with expired timestamp', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'wba-999', time: Date.now() - 600000 }],
      };
      const rawBody = JSON.stringify(payload);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      await expect(
        webhookService.EnqueueMetaWebhook(payload, {
          signature,
          timestamp: Date.now() - 600000,
          rawBody,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should deduplicate replayed duplicate Meta event idempotently', async () => {
      const eventId = 'wamid.HBgL_UNIQUE_DUPLICATE_TEST';
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'wba-999',
            time: Date.now(),
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [{ id: eventId, status: 'delivered', timestamp: Date.now() }],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      // First delivery: success
      const first = await webhookService.EnqueueMetaWebhook(payload, {
        signature,
        timestamp: Date.now(),
        rawBody,
      });
      expect(first.status).toBe('EVENT_RECEIVED');

      // Second delivery with same event ID: deduplicated
      const second = await webhookService.EnqueueMetaWebhook(payload, {
        signature,
        timestamp: Date.now(),
        rawBody,
      });
      expect(second.status).toBe('ALREADY_PROCESSED');
      expect(second.duplicate).toBe(true);
      expect(mockQueueService.EnqueueWebhook).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Zenvlo Request Webhook & Multi-Tenant Isolation', () => {
    it('should verify signature and process delivery receipt status update', async () => {
      const mockLog = {
        id: 'log-1',
        business_id: 'tenant-biz-1',
        message_id: 'msg_valid_test_1',
        delivery_status: 'SENT',
        delivered_at: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const dto = {
        message_id: 'msg_valid_test_1',
        status: 'DELIVERED',
        timestamp: Date.now(),
      };
      const rawBody = JSON.stringify(dto);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      const result = await requestService.HandleWebhook(dto, {
        signature,
        timestamp: dto.timestamp,
        rawBody,
      });

      expect(result.updated).toBe(true);
      expect(mockLog.delivery_status).toBe('DELIVERED');
      expect(mockLog.delivered_at).toBeDefined();
      expect(mockLog.save).toHaveBeenCalled();
    });

    it('should reject cross-tenant tampering attempt when payload business_id mismatches', async () => {
      const mockLog = {
        id: 'log-1',
        business_id: 'tenant-legit-biz-1',
        message_id: 'msg_tenant_check_1',
        delivery_status: 'SENT',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const dto = {
        message_id: 'msg_tenant_check_1',
        status: 'DELIVERED',
        business_id: 'attacker-biz-uuid-999', // Tampered business_id
        timestamp: Date.now(),
      };
      const rawBody = JSON.stringify(dto);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      await expect(
        requestService.HandleWebhook(dto, {
          signature,
          timestamp: dto.timestamp,
          rawBody,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockLog.save).not.toHaveBeenCalled();
    });

    it('should enforce state machine: prevent status regression from DELIVERED to SENT', async () => {
      const mockLog = {
        id: 'log-1',
        business_id: 'biz-1',
        message_id: 'msg_regression_1',
        delivery_status: 'DELIVERED',
        delivered_at: new Date('2026-10-01T12:00:00Z'),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const dto = {
        message_id: 'msg_regression_1',
        status: 'SENT', // Lower rank than current DELIVERED
        timestamp: Date.now(),
      };
      const rawBody = JSON.stringify(dto);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      const result = await requestService.HandleWebhook(dto, {
        signature,
        timestamp: dto.timestamp,
        rawBody,
      });

      expect(result.updated).toBe(false);
      expect(result.ignored).toBe(true);
      expect(result.reason).toBe('STATUS_REGRESSION_PREVENTED');
      expect(mockLog.delivery_status).toBe('DELIVERED'); // Not overwritten
      expect(mockLog.save).not.toHaveBeenCalled();
    });

    it('should enforce state machine: prevent FAILED status for already delivered/read message', async () => {
      const mockLog = {
        id: 'log-1',
        business_id: 'biz-1',
        message_id: 'msg_failed_after_deliv',
        delivery_status: 'DELIVERED',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const dto = {
        message_id: 'msg_failed_after_deliv',
        status: 'FAILED',
        error_message: 'Spurious late failure',
        timestamp: Date.now(),
      };
      const rawBody = JSON.stringify(dto);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      const result = await requestService.HandleWebhook(dto, {
        signature,
        timestamp: dto.timestamp,
        rawBody,
      });

      expect(result.updated).toBe(false);
      expect(result.ignored).toBe(true);
      expect(mockLog.save).not.toHaveBeenCalled();
    });

    it('should ignore duplicate status update if already at current status', async () => {
      const mockLog = {
        id: 'log-1',
        business_id: 'biz-1',
        message_id: 'msg_dup_same_status',
        delivery_status: 'DELIVERED',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const dto = {
        message_id: 'msg_dup_same_status',
        status: 'DELIVERED',
        timestamp: Date.now(),
      };
      const rawBody = JSON.stringify(dto);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      const result = await requestService.HandleWebhook(dto, {
        signature,
        timestamp: dto.timestamp,
        rawBody,
      });

      expect(result.updated).toBe(false);
      expect(result.duplicate).toBe(true);
      expect(mockLog.save).not.toHaveBeenCalled();
    });
  });

  describe('6. Concurrent Duplicate Webhook Processing', () => {
    it('should handle concurrent duplicate webhooks simultaneously with mutex serialization', async () => {
      let callCount = 0;
      const idempotencyKey = 'test_concurrent_key_' + Date.now();

      // Launch 5 concurrent executions for the identical idempotency key
      const concurrentTasks = Array.from({ length: 5 }, async () => {
        return securityService.ExecuteIdempotent(idempotencyKey, async () => {
          callCount++;
          // Simulate async database latency
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { executionId: callCount };
        });
      });

      const results = await Promise.all(concurrentTasks);

      // Exactly ONE must have executed (duplicate: false), and the remaining 4 must be duplicate: true
      const successfulExecutions = results.filter((r) => !r.duplicate);
      const duplicateExecutions = results.filter((r) => r.duplicate);

      expect(callCount).toBe(1);
      expect(successfulExecutions.length).toBe(1);
      expect(duplicateExecutions.length).toBe(4);
      expect(successfulExecutions[0].result).toEqual({ executionId: 1 });
    });

    it('should handle concurrent duplicate delivery webhooks in RequestService without race conditions', async () => {
      let saveCount = 0;
      const mockLog = {
        id: 'log-concurrent-1',
        business_id: 'biz-1',
        message_id: 'msg_race_condition_test',
        delivery_status: 'SENT',
        save: jest.fn().mockImplementation(async () => {
          saveCount++;
          await new Promise((res) => setTimeout(res, 30));
          return true;
        }),
      };
      jest.spyOn(RequestLog, 'findOne').mockResolvedValue(mockLog as any);

      const dto = {
        message_id: 'msg_race_condition_test',
        status: 'DELIVERED',
        timestamp: Date.now(),
      };
      const rawBody = JSON.stringify(dto);
      const signature = computeHmacSha256(TEST_SECRET, rawBody);

      // Send 3 concurrent requests simultaneously
      const results = await Promise.all([
        requestService.HandleWebhook(dto, { signature, timestamp: dto.timestamp, rawBody }),
        requestService.HandleWebhook(dto, { signature, timestamp: dto.timestamp, rawBody }),
        requestService.HandleWebhook(dto, { signature, timestamp: dto.timestamp, rawBody }),
      ]);

      // Exactly 1 update succeeded; others detected as concurrent/processed duplicates
      const updatedResults = results.filter((r) => r.updated);
      expect(updatedResults.length).toBe(1);
      expect(saveCount).toBe(1);
    });
  });
});
