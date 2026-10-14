/**
 * Base payload shared across all asynchronous BullMQ jobs.
 */
export interface BaseJobPayload {
  workspace_id?: string;
  actor_id?: string;
  trace_id?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Tenant-scoped job payload enforcing strict tenant boundary isolation.
 */
export interface TenantJobPayload extends BaseJobPayload {
  workspace_id: string;
}

/**
 * System and operational job payloads.
 */
export interface SystemPingJobPayload extends BaseJobPayload {
  ping_id: string;
  requested_at?: number;
}

export interface SystemCleanupJobPayload extends BaseJobPayload {
  target: string;
  older_than_ms?: number;
}

export type SystemJobPayload = SystemPingJobPayload | SystemCleanupJobPayload;

/**
 * Inbound webhook job payload.
 */
export interface WebhookJobPayload extends BaseJobPayload {
  object: string;
  entry: any[];
  raw_timestamp?: number | string;
}

/**
 * Outbound message delivery job payload.
 */
export interface MessageJobPayload extends TenantJobPayload {
  recipient: string;
  channel?: 'whatsapp' | 'instagram' | 'sms';
  template_name?: string;
  parameters?: Record<string, any>;
  message_id?: string;
}

/**
 * Campaign dispatch and batch processing job payload.
 */
export interface CampaignJobPayload extends TenantJobPayload {
  campaign_id: string;
  batch_id?: string;
  total_recipients?: number;
}

/**
 * Outbound WhatsApp testimonial request job payload.
 */
export interface OutboundWhatsAppJobPayload extends TenantJobPayload {
  request_log_id: string;
  business_id: string;
  customer_id?: string | null;
  customer_phone: string;
  customer_name: string;
  testimonial_url: string;
  custom_message?: string | null;
  idempotency_key: string;
  campaign_id?: string | null;
}

/**
 * Generic Batch Chunk processing payload.
 */
export interface BatchChunkJobPayload extends TenantJobPayload {
  batch_id: string;
  business_id?: string;
  chunk_index: number;
  total_chunks: number;
  operation_type: 'WHATSAPP_TESTIMONIAL_REQUESTS' | 'CUSTOMER_IMPORT' | 'CAMPAIGN_DISPATCH' | string;
  item_ids?: string[];
  items?: Record<string, any>[];
  params?: Record<string, any>;
  idempotency_key: string;
}

/**
 * Asynchronous Google Sync job payload (Google Places & Reviews).
 */
export interface GoogleSyncJobPayload extends TenantJobPayload {
  source_id: string;
  business_id: string;
  external_id: string;
  checkpoint?: {
    last_synced_review_date?: string;
    synced_count?: number;
  };
  idempotency_key?: string;
  forced?: boolean;
}

/**
 * Standard Queue Job Execution Result.
 */
export interface JobExecutionResult<T = any> {
  success: boolean;
  job_id: string;
  queue_name: string;
  processed_at: number;
  duration_ms: number;
  data?: T;
  error?: string;
}
