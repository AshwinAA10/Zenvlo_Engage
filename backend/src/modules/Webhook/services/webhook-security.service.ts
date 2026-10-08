import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  PayloadTooLargeException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import * as crypto from 'crypto';

export interface WebhookVerificationOptions {
  secret: string | undefined;
  rawBody: string;
  signature?: string;
  timestamp?: string | number;
  toleranceSeconds?: number;
  providerName: string;
}

/**
 * WebhookSecurityService
 *
 * Implements security primitives for webhook ingestion:
 * - Constant-time HMAC signature verification (timingSafeEqual)
 * - Timestamp validation and replay attack prevention
 * - In-flight concurrency mutex & idempotency deduplication
 * - Payload size and structural validation
 */
@Injectable()
export class WebhookSecurityService {
  private readonly logger: PinoLogger;
  private readonly defaultToleranceSeconds: number;
  private readonly maxPayloadBytes: number;

  // In-memory idempotency cache: key -> timestamp processed
  private readonly processedKeys = new Map<string, number>();
  // Active in-flight execution promises for concurrency deduplication
  private readonly inFlightLocks = new Map<string, Promise<any>>();

  constructor(
    @Optional() logger?: PinoLogger,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.logger =
      logger ||
      ({
        setContext: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as any);
    this.logger.setContext(WebhookSecurityService.name);

    const tolerance =
      this.configService?.get<string>('WEBHOOK_TOLERANCE_SECONDS') ||
      process.env.WEBHOOK_TOLERANCE_SECONDS;
    this.defaultToleranceSeconds = tolerance ? parseInt(tolerance, 10) : 300;

    const maxBytes =
      this.configService?.get<string>('WEBHOOK_MAX_PAYLOAD_BYTES') ||
      process.env.WEBHOOK_MAX_PAYLOAD_BYTES;
    this.maxPayloadBytes = maxBytes ? parseInt(maxBytes, 10) : 1048576; // 1MB

    // Clean up idempotency keys older than 24 hours every hour
    const cleanupInterval = setInterval(() => this.cleanupOldKeys(), 3600000);
    cleanupInterval.unref?.();
  }

  /**
   * Constant-time HMAC SHA-256 signature verification.
   * Prevents timing attacks using crypto.timingSafeEqual.
   */
  VerifySignature(
    rawBody: string,
    signature: string | undefined,
    secret: string | undefined,
    providerName = 'Webhook',
  ): void {
    const isProduction =
      (this.configService?.get<string>('NODE_ENV') || process.env.NODE_ENV) ===
      'production';

    if (!secret || secret.trim().length === 0) {
      this.logger.error({
        msg: `${providerName} secret not configured. Failing closed.`,
      });
      throw new UnauthorizedException(
        `${providerName} secret is not configured on the server`,
      );
    }

    if (
      isProduction &&
      (secret.startsWith('placeholder_') || secret.includes('your_live_') || secret.includes('your_internal_'))
    ) {
      this.logger.error({
        msg: `${providerName} placeholder secret detected in production. Failing closed.`,
      });
      throw new UnauthorizedException(
        `${providerName} secret cannot use placeholder credentials in production`,
      );
    }

    if (!signature || signature.trim().length === 0) {
      this.logger.warn({
        msg: `Missing signature header for ${providerName}`,
      });
      throw new UnauthorizedException(`Missing ${providerName} signature header`);
    }

    // Support both 'sha256=<hex>' and raw '<hex>'
    let providedHex = signature.trim();
    if (providedHex.startsWith('sha256=')) {
      providedHex = providedHex.slice(7);
    }

    // Verify hex format
    if (!/^[0-9a-fA-F]+$/.test(providedHex)) {
      this.logger.warn({
        msg: `Malformed signature hex for ${providerName}`,
      });
      throw new UnauthorizedException(`Invalid ${providerName} signature format`);
    }

    const expectedHex = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const providedBuffer = Buffer.from(providedHex.toLowerCase(), 'utf8');
    const expectedBuffer = Buffer.from(expectedHex.toLowerCase(), 'utf8');

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      this.logger.warn({
        msg: `Signature mismatch for ${providerName}`,
      });
      throw new UnauthorizedException(`Invalid ${providerName} signature`);
    }
  }

  /**
   * Validates webhook timestamp to prevent replay attacks.
   */
  ValidateTimestamp(
    timestamp: string | number | undefined,
    toleranceSeconds = this.defaultToleranceSeconds,
    providerName = 'Webhook',
  ): number {
    if (timestamp === undefined || timestamp === null || timestamp === '') {
      throw new BadRequestException(`Missing ${providerName} timestamp`);
    }

    let tsMs: number;
    if (typeof timestamp === 'number') {
      tsMs = timestamp < 1e11 ? timestamp * 1000 : timestamp;
    } else if (typeof timestamp === 'string' && /^\d+$/.test(timestamp.trim())) {
      const num = parseInt(timestamp.trim(), 10);
      tsMs = num < 1e11 ? num * 1000 : num;
    } else {
      const parsed = Date.parse(timestamp.toString());
      if (isNaN(parsed)) {
        throw new BadRequestException(`Invalid ${providerName} timestamp format`);
      }
      tsMs = parsed;
    }

    const now = Date.now();
    const ageMs = now - tsMs;

    if (ageMs > toleranceSeconds * 1000) {
      this.logger.warn({
        msg: `${providerName} timestamp expired`,
        ageSeconds: Math.round(ageMs / 1000),
        toleranceSeconds,
      });
      throw new UnauthorizedException(
        `${providerName} timestamp expired. Replay rejected.`,
      );
    }

    // Clock drift: reject requests claiming to be more than 60s in the future
    if (ageMs < -60000) {
      this.logger.warn({
        msg: `${providerName} timestamp is in the future`,
        driftSeconds: Math.round(-ageMs / 1000),
      });
      throw new UnauthorizedException(
        `${providerName} timestamp is in the future. Rejected.`,
      );
    }

    return tsMs;
  }

  /**
   * Rejects oversized payloads before parsing.
   */
  ValidatePayloadSize(rawBody: string | Buffer, maxBytes = this.maxPayloadBytes): void {
    const size = Buffer.isBuffer(rawBody) ? rawBody.length : Buffer.byteLength(rawBody, 'utf8');
    if (size > maxBytes) {
      this.logger.warn({
        msg: 'Webhook payload size exceeded',
        sizeBytes: size,
        maxBytes,
      });
      throw new PayloadTooLargeException(
        `Webhook payload size (${size} bytes) exceeds limit of ${maxBytes} bytes`,
      );
    }
  }

  /**
   * Validates Meta Webhook structural shape.
   */
  ValidateMetaPayloadShape(payload: any): void {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Malformed webhook payload: Expected JSON object');
    }

    if (!payload.object || typeof payload.object !== 'string') {
      throw new BadRequestException('Malformed Meta webhook: Missing object identifier');
    }

    if (!Array.isArray(payload.entry)) {
      throw new BadRequestException('Malformed Meta webhook: Missing or invalid entry array');
    }
  }

  /**
   * Concurrent Mutex & Idempotency Execution:
   * Serializes concurrent requests for the same idempotency key and prevents duplicate execution.
   */
  async ExecuteIdempotent<T>(
    idempotencyKey: string,
    action: () => Promise<T>,
  ): Promise<{ duplicate: boolean; result?: T }> {
    // 1. Check if already processed
    if (this.processedKeys.has(idempotencyKey)) {
      this.logger.info({
        msg: 'Idempotency hit: Webhook event already processed.',
        idempotencyKey,
      });
      return { duplicate: true };
    }

    // 2. Check if a concurrent request for the same key is currently in-flight
    const existingLock = this.inFlightLocks.get(idempotencyKey);
    if (existingLock) {
      this.logger.info({
        msg: 'Concurrent duplicate detected: Awaiting active lock.',
        idempotencyKey,
      });
      await existingLock;
      return { duplicate: true };
    }

    // 3. Acquire lock and execute action
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.inFlightLocks.set(idempotencyKey, lockPromise);

    try {
      const result = await action();
      this.processedKeys.set(idempotencyKey, Date.now());
      return { duplicate: false, result };
    } finally {
      this.inFlightLocks.delete(idempotencyKey);
      resolveLock();
    }
  }

  /**
   * Checks if a key has already been recorded as processed.
   */
  IsDuplicate(idempotencyKey: string): boolean {
    return this.processedKeys.has(idempotencyKey);
  }

  /**
   * Manually records a key as processed.
   */
  RecordProcessed(idempotencyKey: string): void {
    this.processedKeys.set(idempotencyKey, Date.now());
  }

  private cleanupOldKeys(): void {
    const oneDayAgo = Date.now() - 86400000;
    for (const [key, timestamp] of this.processedKeys.entries()) {
      if (timestamp < oneDayAgo) {
        this.processedKeys.delete(key);
      }
    }
  }
}
