import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  @IsNotEmpty()
  channel_id: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  @IsNotEmpty()
  contact_id: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  unread_count?: number;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Hello from Zenvlo Engage!' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 'text' })
  @IsOptional()
  @IsString()
  message_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;
}
