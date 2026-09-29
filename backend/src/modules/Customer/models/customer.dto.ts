import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  IsArray,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Customer full name', example: 'Pooja Hegde' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Customer phone number (WhatsApp enabled)', example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone: string;

  @ApiPropertyOptional({ description: 'Customer email address', example: 'pooja@example.com' })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Internal business notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Segmentation tags', example: ['VIP', 'Salon Regular'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ description: 'Customer full name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Customer phone number' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Customer email address' })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Internal business notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Segmentation tags' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class CustomerQueryDto {
  @ApiPropertyOptional({ description: 'Search term for name, phone, or email' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class ImportCustomerItemDto {
  @ApiProperty({ example: 'Rohan Verma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+919811223344' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'rohan@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Regular clinic patient' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: ['New'] })
  @IsOptional()
  tags?: string[];
}

export class ImportCustomersDto {
  @ApiProperty({ type: [ImportCustomerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportCustomerItemDto)
  customers: ImportCustomerItemDto[];
}

export class ImportCsvContentDto {
  @ApiProperty({ description: 'Raw CSV file text content', example: 'name,phone,email\nRohan,+919811223344,rohan@example.com' })
  @IsString()
  @IsNotEmpty()
  csv_content: string;
}

export class CustomerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  business_id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty()
  tags: string[];

  @ApiProperty()
  created_on: Date;

  @ApiProperty()
  updated_on: Date;
}
