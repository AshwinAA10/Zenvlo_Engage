import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Spring 2026 Promo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'whatsapp', enum: ['whatsapp', 'instagram'] })
  @IsString()
  @IsIn(['whatsapp', 'instagram'])
  @IsNotEmpty()
  channel_type: string;

  @ApiPropertyOptional({ example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional()
  @IsUUID()
  template_id?: string;

  @ApiPropertyOptional({ example: '2026-04-01T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional({ example: 'Spring 2026 Promo - Revised' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '2026-04-02T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;
}
