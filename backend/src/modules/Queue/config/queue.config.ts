import { ConfigService } from '@nestjs/config';
import { DefaultJobOptions } from 'bullmq';

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: any;
  maxRetriesPerRequest: null;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
  retryStrategy?: (times: number) => number | void;
}

export interface WorkerSettingsConfig {
  concurrency: number;
  lockDuration: number;
  stalledInterval: number;
  maxStalledCount: number;
}

/**
 * Builds resilient, centralized Redis connection configuration for BullMQ.
 * Preserves strict compatibility with BullMQ requirements (maxRetriesPerRequest must be null).
 */
export function getRedisConnectionConfig(configService?: ConfigService): RedisConnectionConfig {
  const host =
    configService?.get<string>('REDIS_HOST') ||
    process.env.REDIS_HOST ||
    'localhost';
  const port = parseInt(
    String(
      configService?.get<string>('REDIS_PORT') ||
        process.env.REDIS_PORT ||
        '6379',
    ),
    10,
  );
  const password =
    configService?.get<string>('REDIS_PASSWORD') ||
    process.env.REDIS_PASSWORD ||
    undefined;
  const db = parseInt(
    String(
      configService?.get<string>('REDIS_DB') ||
        process.env.REDIS_DB ||
        '0',
    ),
    10,
  );
  const tlsEnabled =
    (configService?.get<string>('REDIS_TLS') || process.env.REDIS_TLS) === 'true';

  return {
    host,
    port: isNaN(port) ? 6379 : port,
    password: password || undefined,
    db: isNaN(db) ? 0 : db,
    tls: tlsEnabled ? {} : undefined,
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      // Reconnect with exponential backoff up to 3000ms
      return Math.min(times * 100, 3000);
    },
  };
}

/**
 * Calculates exponential backoff with jitter to prevent synchronized thundering herds.
 * Formula: delay = Math.min(maxDelay, baseDelay * 2^attemptsMade) + jitter
 *
 * @param attemptsMade - Current attempt count (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default: 2000)
 * @param maxDelay - Maximum delay cap in milliseconds (default: 60000)
 * @param jitterRatio - Jitter ratio [0.0 - 1.0] (default: 0.2)
 * @param randomFn - Optional random number generator (0.0 to 1.0) for deterministic unit testing
 */
export function calculateBackoffWithJitter(
  attemptsMade: number,
  baseDelay: number = 2000,
  maxDelay: number = 60000,
  jitterRatio: number = 0.2,
  randomFn: () => number = Math.random,
): number {
  const boundedAttempts = Math.max(0, attemptsMade);
  const exponential = Math.min(maxDelay, baseDelay * Math.pow(2, boundedAttempts));
  const jitterRange = exponential * Math.max(0, Math.min(1, jitterRatio));
  const jitter = jitterRange * randomFn();
  return Math.floor(exponential + jitter);
}

/**
 * Shared default job options for BullMQ queues (retries, backoff, and automatic log pruning).
 */
export function getDefaultJobOptions(configService?: ConfigService): DefaultJobOptions {
  const attempts = parseInt(
    String(
      configService?.get<string>('QUEUE_DEFAULT_ATTEMPTS') ||
        process.env.QUEUE_DEFAULT_ATTEMPTS ||
        '3',
    ),
    10,
  );
  const backoffDelay = parseInt(
    String(
      configService?.get<string>('QUEUE_DEFAULT_BACKOFF_DELAY') ||
        process.env.QUEUE_DEFAULT_BACKOFF_DELAY ||
        '2000',
    ),
    10,
  );

  return {
    attempts: isNaN(attempts) ? 3 : attempts,
    backoff: {
      type: 'exponential',
      delay: isNaN(backoffDelay) ? 2000 : backoffDelay,
    },
    removeOnComplete: {
      count: 1000, // Retain last 1000 completed jobs for auditing
      age: 24 * 3600, // Or 24 hours
    },
    removeOnFail: {
      count: 5000, // Retain last 5000 failed jobs for incident debugging
      age: 7 * 24 * 3600, // Or 7 days
    },
  };
}

/**
 * Shared worker tuning options (concurrency, lock durations, stalled detection).
 */
export function getWorkerSettings(configService?: ConfigService): WorkerSettingsConfig {
  const concurrency = parseInt(
    String(
      configService?.get<string>('WORKER_CONCURRENCY') ||
        process.env.WORKER_CONCURRENCY ||
        '5',
    ),
    10,
  );
  const lockDuration = parseInt(
    String(
      configService?.get<string>('WORKER_LOCK_DURATION_MS') ||
        process.env.WORKER_LOCK_DURATION_MS ||
        '30000',
    ),
    10,
  );
  const stalledInterval = parseInt(
    String(
      configService?.get<string>('WORKER_STALLED_INTERVAL_MS') ||
        process.env.WORKER_STALLED_INTERVAL_MS ||
        '30000',
    ),
    10,
  );

  return {
    concurrency: isNaN(concurrency) || concurrency <= 0 ? 5 : concurrency,
    lockDuration: isNaN(lockDuration) || lockDuration <= 0 ? 30000 : lockDuration,
    stalledInterval: isNaN(stalledInterval) || stalledInterval <= 0 ? 30000 : stalledInterval,
    maxStalledCount: 2,
  };
}

/**
 * Sanitizes Redis connection info so secrets are never exposed in logs or health endpoints.
 */
export function sanitizeRedisConfig(config: RedisConnectionConfig): {
  host: string;
  port: number;
  db: number;
  tls: boolean;
  hasPassword: boolean;
} {
  return {
    host: config.host,
    port: config.port,
    db: config.db ?? 0,
    tls: Boolean(config.tls),
    hasPassword: Boolean(config.password),
  };
}

export interface BatchConfig {
  chunkSize: number;
  maxItems: number;
  concurrency: number;
}

/**
 * Validated batch processing limits and tuning parameters.
 */
export function getBatchSettings(configService?: ConfigService): BatchConfig {
  const chunkSize = parseInt(
    String(
      configService?.get<string>('BATCH_CHUNK_SIZE') ||
        process.env.BATCH_CHUNK_SIZE ||
        '50',
    ),
    10,
  );
  const maxItems = parseInt(
    String(
      configService?.get<string>('BATCH_MAX_ITEMS') ||
        process.env.BATCH_MAX_ITEMS ||
        '5000',
    ),
    10,
  );
  const concurrency = parseInt(
    String(
      configService?.get<string>('BATCH_WORKER_CONCURRENCY') ||
        process.env.BATCH_WORKER_CONCURRENCY ||
        '3',
    ),
    10,
  );

  return {
    chunkSize: isNaN(chunkSize) || chunkSize <= 0 ? 50 : Math.min(chunkSize, 250),
    maxItems: isNaN(maxItems) || maxItems <= 0 ? 5000 : Math.min(maxItems, 10000),
    concurrency: isNaN(concurrency) || concurrency <= 0 ? 3 : Math.min(concurrency, 10),
  };
}
