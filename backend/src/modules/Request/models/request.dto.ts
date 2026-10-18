import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequestStatus, RequestChannel } from '../entities/request-log.entity';

export class SendRequestDto {
  @ApiPropertyOptional({
    description: 'Existing customer ID (UUID). If provided, customer details are auto-populated.',
    example: 'd3b07384-d113-494a-9c76-2e88a38b1d92',
  })
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional({
    description: 'Customer name (required if customer_id is not provided)',
    example: 'Rahul Sharma',
  })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({
    description: 'Customer WhatsApp phone number (required if customer_id is not provided)',
    example: '+919876543210',
  })
  @IsOptional()
  @IsString()
  customer_phone?: string;

  @ApiPropertyOptional({
    description: 'Optional personalized note appended to the standard testimonial template',
    example: 'Thank you for visiting us yesterday!',
  })
  @IsOptional()
  @IsString()
  custom_message?: string;
}

export class BatchSendRequestDto {
  @ApiProperty({
    description: 'Array of customer UUIDs to receive WhatsApp requests',
    example: ['d3b07384-d113-494a-9c76-2e88a38b1d92'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  customer_ids: string[];

  @ApiPropertyOptional({
    description: 'Optional personalized note for all recipients in the batch',
  })
  @IsOptional()
  @IsString()
  custom_message?: string;
}

export class RequestQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by delivery status',
    enum: ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'PENDING_CONTRACT'],
  })
  @IsOptional()
  @IsString()
  delivery_status?: RequestStatus;

  @ApiPropertyOptional({ description: 'Search customer name or phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by specific customer UUID' })
  @IsOptional()
  @IsUUID()
  customer_id?: string;
}

export class WhatsAppWebhookDto {
  @ApiProperty({ example: 'msg_123456789' })
  @IsString()
  message_id: string;

  @ApiProperty({ example: 'DELIVERED' })
  @IsString()
  status: string;

  @ApiPropertyOptional({ example: 'Invalid phone number' })
  @IsOptional()
  @IsString()
  error_message?: string;

  @ApiPropertyOptional({ description: 'Optional Business UUID for tenant isolation verification' })
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @ApiPropertyOptional({ description: 'Event timestamp' })
  @IsOptional()
  timestamp?: string | number;
}

export class RequestStatsDto {
  @ApiProperty()
  total_sent: number;

  @ApiProperty()
  delivered: number;

  @ApiProperty()
  read: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  pending_contract: number;

  @ApiProperty()
  feedback_received: number;

  @ApiProperty()
  delivery_rate: number;

  @ApiProperty()
  feedback_conversion_rate: number;
}

export class RequestAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Start date in ISO 8601 format (e.g. 2026-09-15T00:00:00Z)',
    example: '2026-09-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date in ISO 8601 format (e.g. 2026-10-15T23:59:59Z)',
    example: '2026-10-15T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter analytics by messaging channel (default: WHATSAPP)',
    enum: ['WHATSAPP'],
  })
  @IsOptional()
  @IsString()
  channel?: RequestChannel;
}

export class RequestAnalyticsPeriodDto {
  @ApiProperty({ description: 'Effective start date of current period' })
  startDate: string;

  @ApiProperty({ description: 'Effective end date of current period' })
  endDate: string;

  @ApiProperty({ description: 'Start date of comparative previous period' })
  prevStartDate: string;

  @ApiProperty({ description: 'End date of comparative previous period' })
  prevEndDate: string;

  @ApiProperty({ description: 'Duration in days' })
  days: number;
}

export class RequestAnalyticsSummaryDto {
  @ApiProperty({ description: 'Total requests created in the period' })
  total_requests: number;

  @ApiProperty({ description: 'Confirmed delivered requests (DELIVERED or READ)' })
  confirmed_delivered: number;

  @ApiProperty({ description: 'Confirmed read requests (READ receipts received)' })
  confirmed_read: number;

  @ApiProperty({ description: 'Confirmed failed deliveries' })
  confirmed_failed: number;

  @ApiProperty({ description: 'Requests awaiting provider webhook confirmation (QUEUED, SENT, PROCESSING, etc.)' })
  pending_confirmation: number;

  @ApiProperty({ description: 'Customer testimonials submitted in response to requests' })
  feedback_responses: number;

  @ApiPropertyOptional({
    description:
      'Delivery success rate computed strictly from known terminal outcomes: (delivered + read) / (delivered + read + failed) * 100. Returns null if no terminal outcomes yet.',
  })
  delivery_success_rate: number | null;

  @ApiProperty({ description: 'Ratio of confirmed delivered requests to all created requests: (delivered + read) / total_requests * 100' })
  overall_delivery_rate: number;

  @ApiPropertyOptional({
    description:
      'Conversion rate of confirmed delivered requests that submitted feedback: feedback_responses / (delivered + read) * 100. Returns null if no confirmed deliveries.',
  })
  response_rate_delivered: number | null;

  @ApiProperty({ description: 'Conversion rate of all requests that submitted feedback: feedback_responses / total_requests * 100' })
  response_rate_total: number;
}

export class RequestAnalyticsComparisonDto {
  @ApiProperty({ description: 'Total requests in previous period' })
  prev_total_requests: number;

  @ApiProperty({ description: 'Confirmed delivered in previous period' })
  prev_confirmed_delivered: number;

  @ApiProperty({ description: 'Feedback responses in previous period' })
  prev_feedback_responses: number;

  @ApiPropertyOptional({ description: 'Percentage change in total requests vs previous period' })
  total_requests_change_pct: number | null;

  @ApiPropertyOptional({ description: 'Percentage change in delivered requests vs previous period' })
  delivered_change_pct: number | null;

  @ApiPropertyOptional({ description: 'Percentage change in feedback responses vs previous period' })
  responses_change_pct: number | null;
}

export class DeliveryBreakdownItemDto {
  @ApiProperty({ description: 'Delivery status category' })
  status: string;

  @ApiProperty({ description: 'Count of requests with this status' })
  count: number;

  @ApiProperty({ description: 'Percentage of all requests in cohort' })
  percentage: number;

  @ApiProperty({ description: 'Whether this status represents a confirmed terminal outcome' })
  is_terminal: boolean;
}

export class RequestTrendPointDto {
  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ description: 'Requests initiated on this date' })
  created: number;

  @ApiProperty({ description: 'Requests confirmed delivered on this date' })
  delivered: number;

  @ApiProperty({ description: 'Requests confirmed read on this date' })
  read: number;

  @ApiProperty({ description: 'Requests confirmed failed on this date' })
  failed: number;

  @ApiProperty({ description: 'Requests awaiting confirmation on this date' })
  pending: number;

  @ApiProperty({ description: 'Feedback responses received on this date' })
  responses: number;
}

export class RequestAnalyticsResponseDto {
  @ApiProperty({ type: RequestAnalyticsPeriodDto })
  period: RequestAnalyticsPeriodDto;

  @ApiProperty({ type: RequestAnalyticsSummaryDto })
  summary: RequestAnalyticsSummaryDto;

  @ApiProperty({ type: RequestAnalyticsComparisonDto })
  comparison: RequestAnalyticsComparisonDto;

  @ApiProperty({ type: [DeliveryBreakdownItemDto] })
  delivery_breakdown: DeliveryBreakdownItemDto[];

  @ApiProperty({ type: [RequestTrendPointDto] })
  trend: RequestTrendPointDto[];

  @ApiProperty()
  meta: {
    channel: string;
    unknown_outcomes_count: number;
    semantics: Record<string, string>;
  };
}

