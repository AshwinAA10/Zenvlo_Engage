import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookReceiverDto {
  @ApiProperty({ example: 'Customer CRM Sync' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'https://example.com/api/webhook' })
  @IsUrl()
  @IsNotEmpty()
  target_url: string;

  @ApiPropertyOptional({ example: 'whsec_secret_key_123' })
  @IsOptional()
  @IsString()
  secret_key?: string;

  @ApiPropertyOptional({ example: ['message.received', 'message.sent'] })
  @IsOptional()
  @IsArray()
  subscribed_events?: string[];
}

export class UpdateWebhookReceiverDto {
  @ApiPropertyOptional({ example: 'Updated Webhook Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/api/webhook-v2' })
  @IsOptional()
  @IsUrl()
  target_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  subscribed_events?: string[];
}
