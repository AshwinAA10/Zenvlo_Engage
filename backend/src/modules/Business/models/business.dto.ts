import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUrl,
  IsBoolean,
  IsNumber,
  IsArray,
} from 'class-validator';
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

export class OnboardingStatusResponseDto {
  @ApiProperty()
  business_id: string;

  @ApiProperty()
  completed: boolean;

  @ApiProperty()
  dismissed: boolean;

  @ApiProperty()
  current_step: number;

  @ApiProperty({ type: [String] })
  completed_steps: string[];

  @ApiProperty({ type: [String] })
  skipped_steps: string[];

  @ApiProperty()
  has_profile: boolean;

  @ApiProperty()
  has_customer: boolean;

  @ApiProperty()
  has_request: boolean;

  @ApiProperty()
  has_testimonial: boolean;

  @ApiProperty()
  has_widget: boolean;

  @ApiPropertyOptional()
  last_updated_at?: string;
}

export class UpdateOnboardingStatusDto {
  @ApiPropertyOptional({ description: 'Mark overall onboarding as completed' })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @ApiPropertyOptional({ description: 'Dismiss the welcome/onboarding experience' })
  @IsBoolean()
  @IsOptional()
  dismissed?: boolean;

  @ApiPropertyOptional({ description: 'Current active setup step (1-based)' })
  @IsNumber()
  @IsOptional()
  current_step?: number;

  @ApiPropertyOptional({ description: 'Step IDs marked complete', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  completed_steps?: string[];

  @ApiPropertyOptional({ description: 'Step IDs skipped', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skipped_steps?: string[];
}

export class ChecklistItemDto {
  @ApiProperty({ example: 'profile' })
  id: string;

  @ApiProperty({ example: 'Complete Business Profile' })
  title: string;

  @ApiProperty({ example: 'Set up your business name, category, website, and branding for testimonial requests.' })
  description: string;

  @ApiProperty({ example: '/settings' })
  action_url: string;

  @ApiProperty({ example: 'Open Settings' })
  action_label: string;

  @ApiProperty({ example: true })
  completed: boolean;

  @ApiProperty({ example: false })
  is_optional: boolean;

  @ApiPropertyOptional({ example: 'Profile configured' })
  status_hint?: string;
}

export class ChecklistStatusResponseDto {
  @ApiProperty({ example: 'bus-123' })
  business_id: string;

  @ApiProperty({ example: 5 })
  total_tasks: number;

  @ApiProperty({ example: 2 })
  completed_tasks: number;

  @ApiProperty({ example: 40 })
  progress_percentage: number;

  @ApiProperty({ example: false })
  all_completed: boolean;

  @ApiProperty({ example: false })
  dismissed: boolean;

  @ApiProperty({ example: false })
  collapsed: boolean;

  @ApiProperty({ type: [ChecklistItemDto] })
  tasks: ChecklistItemDto[];

  @ApiPropertyOptional()
  last_updated_at?: string;
}

export class UpdateChecklistPreferencesDto {
  @ApiPropertyOptional({ description: 'Dismiss or hide the getting started checklist card' })
  @IsBoolean()
  @IsOptional()
  dismissed?: boolean;

  @ApiPropertyOptional({ description: 'Collapse or expand the checklist item list' })
  @IsBoolean()
  @IsOptional()
  collapsed?: boolean;
}

