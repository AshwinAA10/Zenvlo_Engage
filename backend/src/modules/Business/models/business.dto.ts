import { IsString, IsNotEmpty, IsOptional, MaxLength, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OnboardingDto {
  @ApiProperty({ description: 'Business Name', example: 'Green Orchid Salon & Spa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Business Category', example: 'Salon' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Business Contact Phone', example: '+919876543210' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Business Website URL', example: 'https://greenorchid.in' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ description: 'Business City / Location', example: 'Indiranagar, Bengaluru' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ description: 'Logo Image URL', example: 'https://cdn.zenvlo.com/logos/orchid.png' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  logo_url?: string;
}

export class UpdateBusinessDto {
  @ApiPropertyOptional({ description: 'Business Name' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Business Category' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: 'Business Contact Phone' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Business Website URL' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ description: 'Business City / Location' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ description: 'Logo Image URL' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  logo_url?: string;
}

export class BusinessResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ nullable: true })
  logo_url: string | null;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  website: string | null;

  @ApiProperty({ nullable: true })
  location: string | null;

  @ApiProperty()
  status: number;

  @ApiProperty()
  created_on: Date;

  @ApiProperty()
  updated_on: Date;
}
