import { UnrecoverableError } from 'bullmq';

/**
 * Standard failure categories for asynchronous queue operations.
 */
export enum ErrorCategory {
  /**
   * Transient network errors (DNS lookup failures, connection drops, socket resets, ETIMEDOUT).
   * Safe to retry with bounded exponential backoff.
   */
  TRANSIENT_NETWORK = 'TRANSIENT_NETWORK',

  /**
   * Upstream provider temporary service outage (HTTP 502, 503, 504 before request receipt).
   * Safe to retry with exponential backoff and jitter.
   */
  PROVIDER_OUTAGE = 'PROVIDER_OUTAGE',

  /**
   * Rate limit exceeded (HTTP 429).
   * Safe to retry, respecting Retry-After response headers.
   */
  RATE_LIMIT = 'RATE_LIMIT',

  /**
   * Temporary upstream internal server error (HTTP 500).
   * Safe to retry with bounded attempts.
   */
  SERVER_ERROR = 'SERVER_ERROR',

  /**
   * Permanent client payload validation failure (HTTP 400, 422, invalid phone, missing templates, opted-out recipient, exhausted quotas).
   * Terminal failure: MUST NOT be retried.
   */
  PERMANENT_VALIDATION = 'PERMANENT_VALIDATION',

  /**
   * Permanent authorization or credential failure (HTTP 401, 403, revoked API key, disabled integration).
   * Terminal failure: MUST NOT be retried automatically.
   */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  /**
   * Ambiguous outcome (Timeout or connection abort AFTER request transmission, gateway timeout where provider may have processed message).
   * Safeguarded state: MUST NOT blindly resend without reconciliation to prevent duplicate messages.
   */
  AMBIGUOUS_OUTCOME = 'AMBIGUOUS_OUTCOME',
}

/**
 * Structured classified error details.
 */
export interface ClassifiedFailure {
  category: ErrorCategory;
  isRetryable: boolean;
  statusCode?: number;
  retryAfterSeconds?: number;
  reason: string;
  isAmbiguous: boolean;
  timestamp: string;
}

/**
 * Custom UnrecoverableError indicating that a queue job must reach a terminal state
 * immediately without BullMQ retrying it.
 */
export class UnrecoverableQueueError extends UnrecoverableError {
  public readonly classification: ClassifiedFailure;

  constructor(classification: ClassifiedFailure) {
    super(`[${classification.category}] ${classification.reason}`);
    this.name = 'UnrecoverableQueueError';
    this.classification = classification;
    Object.setPrototypeOf(this, UnrecoverableQueueError.prototype);
  }
}

/**
 * Error classifier inspecting HTTP responses, status codes, error messages and network flags.
 */
export function classifyFailure(
  error: any,
  context?: {
    statusCode?: number;
    retryAfterSeconds?: number;
    isTimeout?: boolean;
    hasSentPayload?: boolean;
    attemptsMade?: number;
    maxAttempts?: number;
  },
): ClassifiedFailure {
  const timestamp = new Date().toISOString();
  const statusCode = context?.statusCode ?? error?.statusCode ?? error?.status;
  const rawMessage: string =
    typeof error === 'string'
      ? error
      : error?.message || error?.errorMessage || String(error || 'Unknown error');

  const lowerMsg = rawMessage.toLowerCase();

  // 1. Ambiguous external outcomes (timeouts or drops when payload was potentially transmitted)
  if (
    context?.isTimeout &&
    (context?.hasSentPayload || lowerMsg.includes('after dispatch') || lowerMsg.includes('transmitted'))
  ) {
    return {
      category: ErrorCategory.AMBIGUOUS_OUTCOME,
      isRetryable: false,
      statusCode: statusCode || 504,
      reason: 'Request timed out after payload was dispatched. Provider receipt is ambiguous.',
      isAmbiguous: true,
      timestamp,
    };
  }

  // 2. Authentication & Credential Failures (401, 403)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('authentication failed') ||
    lowerMsg.includes('invalid api key') ||
    lowerMsg.includes('revoked')
  ) {
    return {
      category: ErrorCategory.INVALID_CREDENTIALS,
      isRetryable: false,
      statusCode: statusCode || 401,
      reason: 'Provider authentication failed or API credentials revoked.',
      isAmbiguous: false,
      timestamp,
    };
  }

  // 3. Client Validation & Business Rules Failures (400, 422, opted out, quota exceeded)
  if (
    statusCode === 400 ||
    statusCode === 422 ||
    lowerMsg.includes('opted out') ||
    lowerMsg.includes('unsubscribed') ||
    lowerMsg.includes('limit reached') ||
    lowerMsg.includes('quota exhausted') ||
    lowerMsg.includes('invalid recipient') ||
    lowerMsg.includes('invalid phone') ||
    lowerMsg.includes('malformed')
  ) {
    return {
      category: ErrorCategory.PERMANENT_VALIDATION,
      isRetryable: false,
      statusCode: statusCode || 400,
      reason: rawMessage,
      isAmbiguous: false,
      timestamp,
    };
  }

  // 4. Rate Limiting (429)
  if (statusCode === 429 || lowerMsg.includes('rate limit') || lowerMsg.includes('too many requests')) {
    const retryAfter = context?.retryAfterSeconds;
    return {
      category: ErrorCategory.RATE_LIMIT,
      isRetryable: true,
      statusCode: 429,
      retryAfterSeconds: retryAfter && retryAfter > 0 ? retryAfter : undefined,
      reason: retryAfter
        ? `Provider rate limit exceeded. Retry after ${retryAfter}s.`
        : 'Provider rate limit exceeded.',
      isAmbiguous: false,
      timestamp,
    };
  }

  // 5. Temporary Provider Outages (502, 503, 504)
  if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return {
      category: ErrorCategory.PROVIDER_OUTAGE,
      isRetryable: true,
      statusCode,
      reason: `Upstream provider service temporarily unavailable (HTTP ${statusCode}).`,
      isAmbiguous: false,
      timestamp,
    };
  }

  // 6. Upstream Internal Server Error (500)
  if (statusCode && statusCode >= 500) {
    return {
      category: ErrorCategory.SERVER_ERROR,
      isRetryable: true,
      statusCode,
      reason: `Upstream provider internal server error (HTTP ${statusCode}).`,
      isAmbiguous: false,
      timestamp,
    };
  }

  // 7. Transient Network Errors (ETIMEDOUT, ECONNRESET, ENOTFOUND, etc.)
  if (
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('socket hang up') ||
    context?.isTimeout
  ) {
    return {
      category: ErrorCategory.TRANSIENT_NETWORK,
      isRetryable: true,
      statusCode: statusCode || 0,
      reason: `Transient network failure: ${rawMessage}`,
      isAmbiguous: false,
      timestamp,
    };
  }

  // Default fallback: Check if attempts exhausted
  const maxAttempts = context?.maxAttempts ?? 3;
  const attemptsMade = context?.attemptsMade ?? 0;
  const isRetryable = attemptsMade < maxAttempts - 1;

  return {
    category: isRetryable ? ErrorCategory.SERVER_ERROR : ErrorCategory.PERMANENT_VALIDATION,
    isRetryable,
    statusCode,
    reason: rawMessage,
    isAmbiguous: false,
    timestamp,
  };
}
