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
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequestStatus } from '../entities/request-log.entity';

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
