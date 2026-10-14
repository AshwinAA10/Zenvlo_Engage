import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { ClsService } from 'nestjs-cls';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import {
  QUEUE_SYSTEM,
  QUEUE_WEBHOOKS,
  QUEUE_MESSAGES,
  QUEUE_CAMPAIGNS,
  JOB_SYSTEM_PING,
  JOB_SYSTEM_CLEANUP,
  JOB_META_WEBHOOK,
  JOB_SEND_MESSAGE,
  JOB_PROCESS_CAMPAIGN,
  CLS_WORKSPACE_ID,
  CLS_USER_ID,
} from '../../../common/constants';
import {
  getRedisConnectionConfig,
  getDefaultJobOptions,
  getWorkerSettings,
  sanitizeRedisConfig,
} from '../config/queue.config';
import { validateEnvironment } from '../../../config/env.validation';
import { QueueService } from '../services/queue.service';
import { QueueHealthService } from '../services/queue-health.service';
import {
  BaseTenantWorkerHost,
  sanitizeErrorMessage,
} from '../processors/base-tenant.processor';
import { SystemProcessor } from '../processors/system.processor';
import { WebhookProcessor } from '../processors/webhook.processor';
import { QueueModule } from '../Queue.module';
import { HealthController } from '../../System/controllers/health.controller';
import { TenantJobPayload, SystemPingJobPayload } from '../interfaces/job.interface';

describe('Phase 1: BullMQ Foundation & Async Architecture', () => {
  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const createMockQueue = (name: string): any => ({
    name,
    add: jest.fn().mockImplementation((jobName: string, data: any, opts: any) =>
      Promise.resolve({ id: `job-${name}-123`, name: jobName, data, opts }),
    ),
    client: Promise.resolve({
      ping: jest.fn().mockResolvedValue('PONG'),
    }),
    isPaused: jest.fn().mockResolvedValue(false),
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 2,
      active: 1,
      failed: 0,
      delayed: 0,
      completed: 10,
    }),
    close: jest.fn().mockResolvedValue(undefined),
  });

  // =========================================================================
  // 1. Centralized Redis & BullMQ Configuration & Sanitization
  // =========================================================================
  describe('1. Centralized Redis & BullMQ Configuration', () => {
    it('should provide robust default connection parameters with BullMQ invariants', () => {
      const config = getRedisConnectionConfig();
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(6379);
      expect(config.db).toBe(0);
      expect(config.maxRetriesPerRequest).toBeNull(); // Absolute requirement for BullMQ
      expect(config.enableReadyCheck).toBe(false);
      expect(typeof config.retryStrategy).toBe('function');
      expect(config.retryStrategy!(5)).toBe(500);
      expect(config.retryStrategy!(50)).toBe(3000); // Caps backoff at 3000ms
    });

    it('should correctly bind custom configuration overrides', () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'REDIS_HOST') return 'redis.internal.zenvlo.com';
          if (key === 'REDIS_PORT') return '6380';
          if (key === 'REDIS_PASSWORD') return 'secure_cluster_pass_99';
          if (key === 'REDIS_DB') return '2';
          if (key === 'REDIS_TLS') return 'true';
          return null;
        }),
      } as unknown as ConfigService;

      const config = getRedisConnectionConfig(mockConfigService);
      expect(config.host).toBe('redis.internal.zenvlo.com');
      expect(config.port).toBe(6380);
      expect(config.password).toBe('secure_cluster_pass_99');
      expect(config.db).toBe(2);
      expect(config.tls).toEqual({});
    });

    it('should sanitize Redis credentials and never expose plaintext passwords', () => {
      const rawConfig = {
        host: 'prod-redis.cluster',
        port: 6379,
        password: 'super_secret_redis_auth_token_xyz',
        db: 1,
        tls: {},
        maxRetriesPerRequest: null,
      };

      const sanitized = sanitizeRedisConfig(rawConfig);
      expect(sanitized.host).toBe('prod-redis.cluster');
      expect(sanitized.port).toBe(6379);
      expect(sanitized.hasPassword).toBe(true);
      expect((sanitized as any).password).toBeUndefined();
    });

    it('should configure sensible worker concurrency and lock durations', () => {
      const settings = getWorkerSettings();
      expect(settings.concurrency).toBeGreaterThanOrEqual(1);
      expect(settings.lockDuration).toBe(30000);
      expect(settings.stalledInterval).toBe(30000);
      expect(settings.maxStalledCount).toBe(2);
    });

    it('should enforce production validation invariants for Redis', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          WHATSAPP_PROVIDER: 'zenvlo',
          ZENVLO_WHATSAPP_API_URL: 'https://api.zenvlo.com/v1',
          ZENVLO_WHATSAPP_API_KEY: 'live_key_zenvlo_prod_123',
          JWT_SECRET: 'a'.repeat(64),
          JWT_REFRESH_SECRET: 'b'.repeat(64),
          POSTGRES_PASSWORD: 'prod_postgres_password',
          REDIS_PORT: 99999, // Invalid port
        });
      }).toThrow('REDIS_PORT must be a valid port number');

      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          WHATSAPP_PROVIDER: 'zenvlo',
          ZENVLO_WHATSAPP_API_URL: 'https://api.zenvlo.com/v1',
          ZENVLO_WHATSAPP_API_KEY: 'live_key_zenvlo_prod_123',
          JWT_SECRET: 'a'.repeat(64),
          JWT_REFRESH_SECRET: 'b'.repeat(64),
          POSTGRES_PASSWORD: 'prod_postgres_password',
          REDIS_HOST: 'redis',
          REDIS_PASSWORD: 'zenvlo_redis_secret', // Insecure default
        });
      }).toThrow('REDIS_PASSWORD cannot use default or placeholder credentials');
    });
  });

  // =========================================================================
  // 2. Queue Service & Strongly-Typed Enqueueing
  // =========================================================================
  describe('2. QueueService Typed Enqueueing & Abstractions', () => {
    let queueService: QueueService;
    let mockSystemQueue: any;
    let mockWebhookQueue: any;
    let mockMessageQueue: any;
    let mockCampaignQueue: any;

    beforeEach(() => {
      mockSystemQueue = createMockQueue(QUEUE_SYSTEM);
      mockWebhookQueue = createMockQueue(QUEUE_WEBHOOKS);
      mockMessageQueue = createMockQueue(QUEUE_MESSAGES);
      mockCampaignQueue = createMockQueue(QUEUE_CAMPAIGNS);

      queueService = new QueueService(
        mockSystemQueue,
        mockWebhookQueue,
        mockMessageQueue,
        mockCampaignQueue,
      );
    });

    it('should enqueue system ping job with payload timestamp and default options', async () => {
      const jobId = await queueService.EnqueueSystemPing({ ping_id: 'test-ping-1' });
      expect(jobId).toBe('job-system-123');
      expect(mockSystemQueue.add).toHaveBeenCalledWith(
        JOB_SYSTEM_PING,
        expect.objectContaining({ ping_id: 'test-ping-1', timestamp: expect.any(Number) }),
        expect.objectContaining({ attempts: 2 }),
      );
    });

    it('should enqueue system cleanup job to system queue', async () => {
      const jobId = await queueService.EnqueueSystemCleanup({ target: 'stale-tokens' });
      expect(jobId).toBe('job-system-123');
      expect(mockSystemQueue.add).toHaveBeenCalledWith(
        JOB_SYSTEM_CLEANUP,
        expect.objectContaining({ target: 'stale-tokens' }),
        expect.any(Object),
      );
    });

    it('should enqueue webhook payload with exponential retry backoff', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] };
      const jobId = await queueService.EnqueueWebhook(payload);
      expect(jobId).toBe('job-webhooks-123');
      expect(mockWebhookQueue.add).toHaveBeenCalledWith(
        JOB_META_WEBHOOK,
        expect.objectContaining({ object: 'whatsapp_business_account' }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }),
      );
    });

    it('should enqueue outbound message job to messages queue', async () => {
      const payload = {
        workspace_id: 'ws-100',
        recipient: '+919876543210',
        body: 'Hello',
      };
      const jobId = await queueService.EnqueueMessage(payload);
      expect(jobId).toBe('job-messages-123');
      expect(mockMessageQueue.add).toHaveBeenCalledWith(
        JOB_SEND_MESSAGE,
        expect.objectContaining({ workspace_id: 'ws-100', recipient: '+919876543210' }),
        expect.any(Object),
      );
    });

    it('should enqueue campaign dispatch job to campaigns queue', async () => {
      const payload = {
        workspace_id: 'ws-100',
        campaign_id: 'cmp-500',
      };
      const jobId = await queueService.EnqueueCampaign(payload);
      expect(jobId).toBe('job-campaigns-123');
      expect(mockCampaignQueue.add).toHaveBeenCalledWith(
        JOB_PROCESS_CAMPAIGN,
        expect.objectContaining({ campaign_id: 'cmp-500' }),
        expect.any(Object),
      );
    });

    it('should retrieve registered queue by name or throw error if unregistered', () => {
      expect(queueService.GetQueue(QUEUE_SYSTEM)).toBe(mockSystemQueue);
      expect(queueService.GetQueue(QUEUE_WEBHOOKS)).toBe(mockWebhookQueue);
      expect(() => queueService.GetQueue('non-existent-queue')).toThrow(
        "Queue 'non-existent-queue' is not registered",
      );
    });

    it('should cleanly close all queues during application shutdown', async () => {
      await queueService.onApplicationShutdown();
      expect(mockSystemQueue.close).toHaveBeenCalledTimes(1);
      expect(mockWebhookQueue.close).toHaveBeenCalledTimes(1);
      expect(mockMessageQueue.close).toHaveBeenCalledTimes(1);
      expect(mockCampaignQueue.close).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. Multi-Tenant Context Propagation & Worker Resiliency
  // =========================================================================
  describe('3. Multi-Tenant Context Propagation & Worker Lifecycle', () => {
    let mockCls: any;

    beforeEach(() => {
      mockCls = {
        run: jest.fn().mockImplementation((fn: () => any) => fn()),
        set: jest.fn(),
        get: jest.fn(),
      };
    });

    class TestTenantWorker extends BaseTenantWorkerHost<TenantJobPayload, any> {
      protected readonly queueName = 'test-queue';
      protected readonly requiresTenant = true;

      constructor(logger: PinoLogger, cls: ClsService) {
        super(logger, cls);
      }

      async handleJob(job: Job<TenantJobPayload, any, string>): Promise<any> {
        return { processed: true, tenant: job.data.workspace_id };
      }
    }

    it('should extract workspace_id and actor_id and bind to ClsService during job execution', async () => {
      const worker = new TestTenantWorker(mockLogger as any, mockCls);
      const mockJob = {
        id: 'job-999',
        name: 'test-tenant-task',
        data: {
          workspace_id: 'ws-tenant-uuid-1',
          actor_id: 'usr-actor-uuid-2',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
      } as unknown as Job<TenantJobPayload>;

      const result = await worker.process(mockJob);
      expect(result).toEqual({ processed: true, tenant: 'ws-tenant-uuid-1' });

      // Verifies CLS binding
      expect(mockCls.run).toHaveBeenCalledTimes(1);
      expect(mockCls.set).toHaveBeenCalledWith(CLS_WORKSPACE_ID, 'ws-tenant-uuid-1');
      expect(mockCls.set).toHaveBeenCalledWith(CLS_USER_ID, 'usr-actor-uuid-2');

      // Verifies structured lifecycle logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-999',
          jobName: 'test-tenant-task',
          workspaceId: 'ws-tenant-uuid-1',
        }),
        'BullMQ job execution started',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-999',
          durationMs: expect.any(Number),
        }),
        'BullMQ job execution completed successfully',
      );
    });

    it('should reject tenant-scoped job if workspace_id is absent', async () => {
      const worker = new TestTenantWorker(mockLogger as any, mockCls);
      const mockJob = {
        id: 'job-invalid-no-tenant',
        name: 'test-tenant-task',
        data: {
          timestamp: Date.now(),
        } as any,
        attemptsMade: 0,
      } as unknown as Job<TenantJobPayload>;

      await expect(worker.process(mockJob)).rejects.toThrow(
        /missing workspace_id/,
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should sanitize credentials, tokens, and secrets in error logs when worker fails', async () => {
      class FailingWorker extends BaseTenantWorkerHost<TenantJobPayload, any> {
        protected readonly queueName = 'test-queue';
        protected readonly requiresTenant = false;

        async handleJob(): Promise<any> {
          throw new Error('Database connection failed: password=super_secret_pg_pwd_123 token=abc123bearer');
        }
      }

      const worker = new FailingWorker(mockLogger as any, mockCls);
      const mockJob = {
        id: 'job-err-1',
        name: 'failing-task',
        data: { timestamp: Date.now() },
        attemptsMade: 1,
      } as unknown as Job<TenantJobPayload>;

      await expect(worker.process(mockJob)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-err-1',
          errorMessage: expect.not.stringContaining('super_secret_pg_pwd_123'),
        }),
        'BullMQ job execution failed',
      );
    });

    it('sanitizeErrorMessage utility should redact bearer tokens and secrets', () => {
      const raw = 'Error Bearer eyJhbGciOiJIUzI1NiJ9.abc.xyz occurred with secret: my_secret_key_123 and redis://user:redis_pwd_pass@localhost:6379';
      const clean = sanitizeErrorMessage(raw);
      expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(clean).not.toContain('my_secret_key_123');
      expect(clean).not.toContain('redis_pwd_pass');
      expect(clean).toContain('[REDACTED]');
    });
  });

  // =========================================================================
  // 4. Concrete Processors: System & Webhook
  // =========================================================================
  describe('4. Concrete Processors (System & Webhook)', () => {
    let mockCls: any;

    beforeEach(() => {
      mockCls = {
        run: jest.fn().mockImplementation((fn: () => any) => fn()),
        set: jest.fn(),
        get: jest.fn(),
      };
    });

    it('SystemProcessor should process JOB_SYSTEM_PING and calculate latency', async () => {
      const processor = new SystemProcessor(mockLogger as any, mockCls);
      const reqTime = Date.now() - 50;
      const mockJob = {
        id: 'ping-1',
        name: JOB_SYSTEM_PING,
        data: {
          ping_id: 'p-1',
          requested_at: reqTime,
          timestamp: reqTime,
        },
        attemptsMade: 0,
      } as unknown as Job<SystemPingJobPayload>;

      const result = await processor.process(mockJob);
      expect(result.pong).toBe(true);
      expect(result.ping_id).toBe('p-1');
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('WebhookProcessor should process Meta webhook payload asynchronously', async () => {
      const processor = new WebhookProcessor(mockLogger as any, mockCls);
      const mockJob = {
        id: 'wh-1',
        name: JOB_META_WEBHOOK,
        data: {
          object: 'whatsapp_business_account',
          entry: [{ id: 'entry-1' }],
          timestamp: Date.now(),
        },
        attemptsMade: 0,
      } as unknown as Job<any>;

      const result = await processor.process(mockJob);
      expect(result.processed).toBe(true);
      expect(result.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Decoupled Architecture & QueueModule Registration
  // =========================================================================
  describe('5. Decoupled Architecture & Worker Configuration', () => {
    it('QueueModule.register should support enabling or disabling workers', () => {
      const moduleWithoutWorkers = QueueModule.register({ enableWorkers: false });
      expect(moduleWithoutWorkers.module).toBe(QueueModule);
      expect(moduleWithoutWorkers.providers).not.toContain(WebhookProcessor);
      expect(moduleWithoutWorkers.providers).not.toContain(SystemProcessor);

      const moduleWithWorkers = QueueModule.register({ enableWorkers: true });
      expect(moduleWithWorkers.providers).toContain(WebhookProcessor);
      expect(moduleWithWorkers.providers).toContain(SystemProcessor);
    });
  });

  // =========================================================================
  // 6. Health & Readiness Observability
  // =========================================================================
  describe('6. Queue & Redis Health / Readiness Checks', () => {
    let queueService: QueueService;
    let mockSystemQueue: any;
    let mockWebhookQueue: any;
    let mockConfigService: any;

    beforeEach(() => {
      mockSystemQueue = createMockQueue(QUEUE_SYSTEM);
      mockWebhookQueue = createMockQueue(QUEUE_WEBHOOKS);
      const mockMessageQueue = createMockQueue(QUEUE_MESSAGES);
      const mockCampaignQueue = createMockQueue(QUEUE_CAMPAIGNS);

      queueService = new QueueService(
        mockSystemQueue,
        mockWebhookQueue,
        mockMessageQueue,
        mockCampaignQueue,
      );

      mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_PORT') return '6379';
          if (key === 'ENABLE_WORKERS') return 'true';
          return null;
        }),
      };
    });

    it('should return healthy status when Redis ping succeeds and queues are active', async () => {
      const healthService = new QueueHealthService(mockConfigService, queueService, mockLogger as any);
      const report = await healthService.checkHealth();

      expect(report.status).toBe('healthy');
      expect(report.redis.connected).toBe(true);
      expect(report.redis.host).toBe('localhost');
      expect(report.redis.port).toBe(6379);
      expect(report.workers_enabled).toBe(true);
      expect(report.queues.length).toBe(4);
      expect(report.queues[0].waiting).toBe(2);
    });

    it('should report unhealthy status without crashing when Redis is unreachable', async () => {
      // Mock Redis client failure
      mockSystemQueue.client = Promise.resolve({
        ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED: Redis unavailable')),
      });

      const healthService = new QueueHealthService(mockConfigService, queueService, mockLogger as any);
      const report = await healthService.checkHealth();

      expect(report.status).toBe('unhealthy');
      expect(report.redis.connected).toBe(false);
      expect(report.redis.error).toBeDefined();
    });

    it('should report degraded status if a queue is paused', async () => {
      mockSystemQueue.isPaused = jest.fn().mockResolvedValue(true);

      const healthService = new QueueHealthService(mockConfigService, queueService, mockLogger as any);
      const report = await healthService.checkHealth();

      expect(report.status).toBe('degraded');
      expect(report.redis.connected).toBe(true);
    });

    it('HealthController should return HTTP 200 on /health and /health/ready when healthy', async () => {
      const healthService = new QueueHealthService(mockConfigService, queueService, mockLogger as any);
      const controller = new HealthController(healthService);

      const baseHealth = controller.check();
      expect(baseHealth.status).toBe('ok');

      const readiness = await controller.checkReadiness();
      expect(readiness.ready).toBe(true);
      expect(readiness.dependencies?.redis).toBe(true);

      const queueDetails = await controller.checkQueue();
      expect(queueDetails.status).toBe('healthy');
    });

    it('HealthController should throw HTTP 503 on /health/ready when Redis is unreachable', async () => {
      mockSystemQueue.client = Promise.resolve({
        ping: jest.fn().mockRejectedValue(new Error('Connection failed')),
      });

      const healthService = new QueueHealthService(mockConfigService, queueService, mockLogger as any);
      const controller = new HealthController(healthService);

      await expect(controller.checkReadiness()).rejects.toThrow(HttpException);
      try {
        await controller.checkReadiness();
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });
  });
});
