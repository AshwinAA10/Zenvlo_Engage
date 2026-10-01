import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchPlaceDto {
  @ApiProperty({
    description: 'Search query for Google Place (e.g., business name, clinic or salon with city)',
    example: 'Dr. Mehta Dental Clinic Indiranagar Bengaluru',
  })
  @IsString()
  query: string;
}

export class ConnectPlaceDto {
  @ApiProperty({
    description: 'Google Place ID obtained from search',
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  })
  @IsString()
  place_id: string;
}

export class ReviewQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by specific star rating (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Filter by connected review source ID' })
  @IsOptional()
  @IsUUID()
  source_id?: string;

  @ApiPropertyOptional({ description: 'Filter by visibility in website widgets' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  is_visible?: boolean;

  @ApiPropertyOptional({ description: 'Search reviewer name or review text' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ToggleReviewVisibilityDto {
  @ApiProperty({ description: 'Whether review should be visible in widgets' })
  @IsBoolean()
  is_visible: boolean;
}

export class ReviewStatsDto {
  @ApiProperty()
  average_rating: number;

  @ApiProperty()
  total_reviews: number;

  @ApiProperty()
  visible_reviews: number;

  @ApiProperty({
    example: { '5': 45, '4': 12, '3': 2, '2': 0, '1': 1 },
  })
  distribution: Record<string, number>;
}
