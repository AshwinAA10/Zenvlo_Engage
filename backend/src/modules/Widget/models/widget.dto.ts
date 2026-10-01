import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WidgetType, WidgetTheme } from '../entities/widget.entity';

export class CreateWidgetDto {
  @ApiProperty({ example: 'Main Website Wall' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: ['WALL', 'CAROUSEL', 'BADGE'], default: 'WALL' })
  @IsOptional()
  @IsEnum(['WALL', 'CAROUSEL', 'BADGE'])
  type?: WidgetType = 'WALL';

  @ApiPropertyOptional({ enum: ['LIGHT', 'DARK', 'AUTO'], default: 'DARK' })
  @IsOptional()
  @IsEnum(['LIGHT', 'DARK', 'AUTO'])
  theme?: WidgetTheme = 'DARK';

  @ApiPropertyOptional({ example: '#10B981', default: '#10B981' })
  @IsOptional()
  @IsString()
  primary_color?: string = '#10B981';

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  max_items?: number = 12;

  @ApiPropertyOptional({ default: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  min_rating?: number = 4;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  show_google_reviews?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  show_photos?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  show_date?: boolean = true;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  custom_css?: string;
}

export class UpdateWidgetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['WALL', 'CAROUSEL', 'BADGE'] })
  @IsOptional()
  @IsEnum(['WALL', 'CAROUSEL', 'BADGE'])
  type?: WidgetType;

  @ApiPropertyOptional({ enum: ['LIGHT', 'DARK', 'AUTO'] })
  @IsOptional()
  @IsEnum(['LIGHT', 'DARK', 'AUTO'])
  theme?: WidgetTheme;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primary_color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  max_items?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  min_rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  show_google_reviews?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  show_photos?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  show_date?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  custom_css?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export interface PublicSocialProofItem {
  id: string;
  source_type: 'TESTIMONIAL' | 'GOOGLE';
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  content: string;
  date: string;
  photo_url?: string | null;
  video_url?: string | null;
}

export class PublicWidgetResponseDto {
  @ApiProperty()
  widget: {
    id: string;
    name: string;
    type: WidgetType;
    theme: WidgetTheme;
    primary_color: string;
    show_photos: boolean;
    show_date: boolean;
    custom_css: string | null;
  };

  @ApiProperty()
  business: {
    name: string;
    slug: string;
    logo_url: string | null;
    category: string;
    rating: number;
    review_count: number;
  };

  @ApiProperty()
  items: PublicSocialProofItem[];
}
