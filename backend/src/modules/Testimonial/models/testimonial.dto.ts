import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsBoolean,
  Equals,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApprovalStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class SubmitPublicTestimonialDto {
  @ApiProperty({ description: 'Rating from 1 to 5 stars', example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Detailed feedback or testimonial text', example: 'The haircut and facial service was amazing! Highly recommend.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  content: string;

  @ApiProperty({ description: 'Customer full name', example: 'Ananya Roy' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  customer_name: string;

  @ApiPropertyOptional({ description: 'Customer phone number (private, for verification)', example: '+919876543210' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  customer_phone?: string;

  @ApiPropertyOptional({ description: 'Customer email address (private)', example: 'ananya@example.com' })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  customer_email?: string;

  @ApiPropertyOptional({ description: 'Optional photo URL' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  photo_url?: string;

  @ApiPropertyOptional({ description: 'Optional video URL' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  video_url?: string;

  @ApiProperty({ description: 'Customer consent to publish testimonial', example: true })
  @IsBoolean()
  @Equals(true, { message: 'You must provide consent to publish your review' })
  consent_given: boolean;
}

export class UpdateTestimonialStatusDto {
  @ApiProperty({ enum: ApprovalStatusEnum, example: ApprovalStatusEnum.APPROVED })
  @IsEnum(ApprovalStatusEnum)
  status: ApprovalStatusEnum;

  @ApiPropertyOptional({ description: 'Optional reason for rejection' })
  @IsString()
  @IsOptional()
  rejection_reason?: string;
}

export class TestimonialQueryDto {
  @ApiPropertyOptional({ enum: ['ALL', 'PENDING', 'APPROVED', 'REJECTED'], default: 'ALL' })
  @IsString()
  @IsOptional()
  status?: string = 'ALL';

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

export class PublicTestimonialResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customer_name: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  content: string;

  @ApiProperty({ nullable: true })
  photo_url: string | null;

  @ApiProperty({ nullable: true })
  video_url: string | null;

  @ApiProperty()
  created_on: Date;
}
