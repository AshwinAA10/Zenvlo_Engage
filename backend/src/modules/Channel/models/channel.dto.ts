import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChannelDto {
  @ApiProperty({ example: 'whatsapp', enum: ['whatsapp', 'instagram'] })
  @IsString()
  @IsIn(['whatsapp', 'instagram'])
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'Main WhatsApp Support' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '109876543210' })
  @IsString()
  @IsNotEmpty()
  channel_identifier: string;

  @ApiPropertyOptional({ example: { access_token: 'EAAB...' } })
  @IsOptional()
  credentials?: Record<string, any>;
}

export class UpdateChannelDto {
  @ApiPropertyOptional({ example: 'Updated WhatsApp Support' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_connected?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  credentials?: Record<string, any>;
}
