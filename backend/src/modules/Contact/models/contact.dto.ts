import { IsArray, IsEmail, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiPropertyOptional({ example: 'Sarah' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Connor' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: '+14155552671' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({ example: 'sarah_c' })
  @IsOptional()
  @IsString()
  instagram_handle?: string;

  @ApiPropertyOptional({ example: 'sarah@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: { tier: 'vip', city: 'SF' } })
  @IsOptional()
  @IsObject()
  custom_attributes?: Record<string, any>;

  @ApiPropertyOptional({ example: ['lead', 'hot'] })
  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class UpdateContactDto {
  @ApiPropertyOptional({ example: 'Sarah' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Connor' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: '+14155552671' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({ example: 'sarah_c' })
  @IsOptional()
  @IsString()
  instagram_handle?: string;

  @ApiPropertyOptional({ example: 'sarah@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  custom_attributes?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[];
}
