import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Production Workspace' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'production-workspace' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  @IsNotEmpty()
  organization_id: string;

  @ApiPropertyOptional({ example: { timezone: 'UTC' } })
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Updated Workspace Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: { timezone: 'Asia/Kolkata' } })
  @IsOptional()
  settings?: Record<string, any>;
}
