import { SetMetadata } from '@nestjs/common';
import { RateLimitRule } from '../interfaces/rate-limit.interface';

export const RATE_LIMIT_METADATA_KEY = 'RATE_LIMIT_METADATA_KEY';
export const SKIP_RATE_LIMIT_METADATA_KEY = 'SKIP_RATE_LIMIT_METADATA_KEY';

/**
 * Custom rate limit decorator for controller classes or route handlers.
 */
export const RateLimit = (options: RateLimitRule) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);

/**
 * Decorator to explicitly skip rate limiting on a handler or controller.
 */
export const SkipRateLimit = () =>
  SetMetadata(SKIP_RATE_LIMIT_METADATA_KEY, true);
