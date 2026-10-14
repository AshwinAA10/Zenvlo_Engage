import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { QueueService } from './queue.service';
import { getRedisConnectionConfig, sanitizeRedisConfig } from '../config/queue.config';

export interface QueueStatusReport {
  name: string;
  isPaused: boolean;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
}

export interface QueueHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  redis: {
    connected: boolean;
    host: string;
    port: number;
    db: number;
    tls: boolean;
    hasPassword: boolean;
    latency_ms?: number;
    error?: string;
  };
  workers_enabled: boolean;
  queues: QueueStatusReport[];
}

@Injectable()
export class QueueHealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    @Optional() private readonly logger?: PinoLogger,
  ) {
    this.logger?.setContext(QueueHealthService.name);
  }

  /**
   * Evaluates Redis connectivity and BullMQ queue statuses without exposing secrets.
   */
  async checkHealth(): Promise<QueueHealthReport> {
    const redisConfig = getRedisConnectionConfig(this.configService);
    const sanitizedRedis = sanitizeRedisConfig(redisConfig);
    const workersEnabled =
      (this.configService.get<string>('ENABLE_WORKERS') ||
        process.env.ENABLE_WORKERS ||
        'true').toLowerCase() !== 'false';

    const timestamp = new Date().toISOString();
    const queues = this.queueService.GetAllQueues();

    if (queues.size === 0) {
      return {
        status: 'degraded',
        timestamp,
        redis: {
          connected: false,
          ...sanitizedRedis,
          error: 'No BullMQ queues are registered',
        },
        workers_enabled: workersEnabled,
        queues: [],
      };
    }

    try {
      // Pick first queue to test client ping
      const firstQueue = queues.values().next().value;
      const startTime = Date.now();
      const client = await firstQueue.client;

      // Ping with 2000ms timeout
      const pingPromise = client.ping();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out after 2000ms')), 2000),
      );

      const pong = await Promise.race([pingPromise, timeoutPromise]);
      const latencyMs = Date.now() - startTime;

      if (pong !== 'PONG') {
        return {
          status: 'unhealthy',
          timestamp,
          redis: {
            connected: false,
            ...sanitizedRedis,
            error: `Unexpected Redis ping response: ${pong}`,
          },
          workers_enabled: workersEnabled,
          queues: [],
        };
      }

      // Collect queue states
      const queueReports: QueueStatusReport[] = [];
      let anyQueuePaused = false;

      for (const [name, queue] of queues.entries()) {
        try {
          const isPaused = await queue.isPaused();
          if (isPaused) anyQueuePaused = true;

          const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
          queueReports.push({
            name,
            isPaused,
            waiting: counts.waiting || 0,
            active: counts.active || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
          });
        } catch (err: any) {
          queueReports.push({
            name,
            isPaused: false,
            waiting: -1,
            active: -1,
            failed: -1,
            delayed: -1,
          });
        }
      }

      return {
        status: anyQueuePaused ? 'degraded' : 'healthy',
        timestamp,
        redis: {
          connected: true,
          ...sanitizedRedis,
          latency_ms: latencyMs,
        },
        workers_enabled: workersEnabled,
        queues: queueReports,
      };
    } catch (err: any) {
      this.logger?.warn(
        { err: err.message },
        'Redis/BullMQ health check failed; Redis appears unreachable',
      );

      return {
        status: 'unhealthy',
        timestamp,
        redis: {
          connected: false,
          ...sanitizedRedis,
          error: 'Redis connection unavailable or timed out',
        },
        workers_enabled: workersEnabled,
        queues: [],
      };
    }
  }
}
